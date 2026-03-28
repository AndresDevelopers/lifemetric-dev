import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { unstable_cache } from 'next/cache';

// Inicializar el cliente de Redis solo si las variables de entorno están presentes
export const redisClient =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// Tasa límite para prevenir abusos (Rate Limiting inteligente)
// Permite 20 requests por 10 segundos
export const rateLimit = redisClient
  ? new Ratelimit({
      redis: redisClient, 
      limiter: Ratelimit.slidingWindow(20, '10 s'),
      analytics: true,
      /**
       * Prefix in redis
       */
      prefix: '@upstash/ratelimit',
    })
  : {
      // Fallback: Si no hay Upstash, siempre permite la request (modo desarrollo o resiliencia local)
      limit: async () => ({
        success: true,
        pending: Promise.resolve(),
        limit: 100,
        remaining: 99,
        reset: Date.now() + 10000,
      }),
    };

/**
 * Validar Rate Limit devolviendo boolean
 */
export const checkRateLimit = async (identifier: string): Promise<boolean> => {
  try {
    const limiter = rateLimit as Ratelimit;
    const { success } = await limiter.limit(identifier);
    return success;
  } catch (error) {
    console.error('Rate limit check failed, allowing request to maintain resilience:', error);
    // Fallback gracefully on upstash failure (Zero-Downtime Rule)
    return true;
  }
};

/**
 * Cache Inteligente (Next.js Data Cache [Cloudflare CDN] + Upstash Redis)
 * Usa Next.js cache (para Edge CDN/Cloudflare ISR) y Upstash Redis para consistencia L2 distribuida,
 * implementando resiliencia inteligente.
 */
export async function intelligentCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    revalidate?: number | false;
    tags?: string[];
  } = {}
): Promise<T> {
  const cachedFn = unstable_cache(
    async () => {
      // Modo "Sin Redis": solo usa cache L1 (Next.js -> Cloudflare/Edge)
      if (!redisClient) {
        return fetcher();
      }

      try {
        // Intenta obtener primero de Redis (Cache L2)
        const cached = await redisClient.get<T>(key);
        if (cached !== null && cached !== undefined) {
           return cached as T;
        }

        // Datos frescos si no hay nada en Redis
        const freshData = await fetcher();

        // Evitar guardar nulos no esperados
        if (freshData !== null && freshData !== undefined) {
             // Guardar asincrónicamente para no bloquear la request actual
            const ex = typeof options.revalidate === 'number' ? options.revalidate : 60;
            redisClient.set(key, freshData, { ex }).catch((e) => {
               console.error('Upstash Redis L2 background save failed:', e);
            });
        }

        return freshData;
      } catch (err) {
        console.error('Intelligent Cache (Redis L2) falied or timeout, falling back transparently:', err);
        return fetcher(); // Fallback transparente a DB principal
      }
    },
    [key],
    {
      revalidate: options.revalidate,
      tags: options.tags || [key],
    }
  );

  return cachedFn();
}
