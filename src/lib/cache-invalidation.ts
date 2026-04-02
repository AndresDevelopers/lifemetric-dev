import { revalidateTag } from "next/cache";
import { redisClient } from "@/lib/redis";

/**
 * Invalida el caché de sugerencias de IA para un paciente específico
 * cuando se detectan datos nuevos (comidas, glucosa, hábitos, etc.)
 */
export async function invalidatePatientSummaryCache(pacienteId: string) {
  try {
    // Next.js 16 recomienda stale-while-revalidate con profile="max".
    revalidateTag(`ai-suggestions-${pacienteId}`, "max");
    revalidateTag(`patient-${pacienteId}`, "max");

    const redis = redisClient;
    if (redis) {
      try {
        // Upstash no soporta SCAN eficientemente en este flujo; registramos las keys por paciente.
        const keysSetKey = `patient-cache-keys:${pacienteId}`;
        const storedKeys = await redis.smembers(keysSetKey);
        const keys = Array.isArray(storedKeys)
          ? storedKeys.filter((key): key is string => typeof key === "string")
          : [];

        if (keys.length > 0) {
          await Promise.all(keys.map((key) => redis.del(key)));
          await redis.del(keysSetKey);
        }
      } catch (error) {
        console.error("Failed to invalidate Redis cache:", error);
      }
    }

    console.log(`Cache invalidated for patient: ${pacienteId}`);
  } catch (error) {
    console.error("Failed to invalidate patient summary cache:", error);
  }
}

/**
 * Registra una key de caché para un paciente (para poder invalidarla después)
 */
export async function registerCacheKey(pacienteId: string, cacheKey: string) {
  const redis = redisClient;
  if (!redis) return;

  try {
    const keysSetKey = `patient-cache-keys:${pacienteId}`;
    await redis.sadd(keysSetKey, cacheKey);
    await redis.expire(keysSetKey, 604800);
  } catch (error) {
    console.error("Failed to register cache key:", error);
  }
}

/**
 * Invalida el caché cuando se crean/actualizan datos del paciente
 */
export async function invalidateOnDataChange(
  pacienteId: string,
  dataType: "comida" | "glucosa" | "habito" | "medicacion" | "laboratorio",
) {
  console.log(`Data change detected for patient ${pacienteId}: ${dataType}`);
  await invalidatePatientSummaryCache(pacienteId);
}
