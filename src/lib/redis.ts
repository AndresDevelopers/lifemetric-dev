import { Redis } from '@upstash/redis';
import { unstable_cache } from 'next/cache';

// Inicializar el cliente de Redis solo si las variables de entorno están presentes.
export const redisClient =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const RATE_LIMIT_WINDOW_SECONDS = 10;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_PROVIDER_CLOUDFLARE = 'cloudflare';
const RATE_LIMIT_PROVIDER_REDIS = 'redis';
const RATE_LIMIT_PROVIDER_NONE = 'none';

type RateLimitProvider =
  | typeof RATE_LIMIT_PROVIDER_CLOUDFLARE
  | typeof RATE_LIMIT_PROVIDER_REDIS
  | typeof RATE_LIMIT_PROVIDER_NONE;

const hasCloudflareRateLimitBinding =
  process.env.CLOUDFLARE_RATE_LIMIT_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_CLOUDFLARE_RATE_LIMIT_ENABLED === 'true' ||
  Boolean(process.env.CLOUDFLARE_API_TOKEN) ||
  Boolean(process.env.CLOUDFLARE_ZONE_ID) ||
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);

export const getRateLimitProvider = (): RateLimitProvider => {
  if (hasCloudflareRateLimitBinding) {
    return RATE_LIMIT_PROVIDER_CLOUDFLARE;
  }

  if (redisClient) {
    return RATE_LIMIT_PROVIDER_REDIS;
  }

  return RATE_LIMIT_PROVIDER_NONE;
};

/**
 * Prioridad del rate limit:
 * 1. Cloudflare
 * 2. Upstash Redis
 * 3. Sin rate limit (modo resiliente)
 */
export const checkRateLimit = async (identifier: string): Promise<boolean> => {
  const provider = getRateLimitProvider();
  const activeRedisClient = redisClient;

  if (
    provider === RATE_LIMIT_PROVIDER_CLOUDFLARE ||
    provider === RATE_LIMIT_PROVIDER_NONE ||
    !activeRedisClient
  ) {
    return true;
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();
  if (!normalizedIdentifier) {
    return true;
  }

  const key = `ratelimit:${normalizedIdentifier}`;

  try {
    const requests = await activeRedisClient.incr(key);
    await activeRedisClient.expire(key, RATE_LIMIT_WINDOW_SECONDS);

    return requests <= RATE_LIMIT_MAX_REQUESTS;
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
