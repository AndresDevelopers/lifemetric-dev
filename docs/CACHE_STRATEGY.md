# Estrategia de Caché Multinivel - Página de Resumen

## Arquitectura de Caché en Capas

El sistema implementa una estrategia de caché en 3 niveles para optimizar el rendimiento de la página de resumen:

```
Usuario → Cloudflare CDN → Redis/Upstash → Base de Datos → IA (Gemini)
          (Edge Cache)      (L2 Cache)      (Persistent)   (Generación)
```

## Niveles de Caché

### 1. Cloudflare CDN (Edge Cache)
- **Ubicación**: Edge locations de Cloudflare
- **Duración**: 5 minutos (`revalidate = 300`)
- **Tecnología**: Next.js ISR (Incremental Static Regeneration)
- **Ventaja**: Latencia ultra-baja (~10-50ms)

### 2. Redis/Upstash (L2 Cache)
- **Ubicación**: Redis distribuido
- **Duración**: 1 hora (configurable)
- **Tecnología**: `intelligentCache()` de `/src/lib/redis.ts`
- **Ventaja**: Compartido entre todas las edge locations
- **Fallback**: Si Redis no está disponible, pasa directamente a DB

### 3. Base de Datos (Persistent Cache)
- **Ubicación**: PostgreSQL/Prisma
- **Duración**: Indefinida hasta que cambien los datos
- **Tabla**: `summaryAiCache`
- **Ventaja**: Caché permanente con validación por hash

## Flujo de Lectura

```typescript
1. Request → Cloudflare CDN
   ├─ Cache HIT → Respuesta inmediata (10-50ms)
   └─ Cache MISS → Continuar

2. Redis/Upstash
   ├─ Cache HIT → Respuesta rápida (50-100ms)
   └─ Cache MISS → Continuar

3. Base de Datos
   ├─ Cache HIT (hash válido) → Respuesta (100-200ms)
   └─ Cache MISS → Continuar

4. Generar con IA (Gemini)
   └─ Guardar en DB → Guardar en Redis → Respuesta (3-10s)
```

## Invalidación Inteligente

El caché se invalida automáticamente cuando se detectan datos nuevos:

### Triggers de Invalidación

```typescript
// Cuando se crea/actualiza cualquier dato del paciente:
- Nueva comida → invalidateOnDataChange(pacienteId, 'comida')
- Nueva glucosa → invalidateOnDataChange(pacienteId, 'glucosa')
- Nuevo hábito → invalidateOnDataChange(pacienteId, 'habito')
- Nueva medicación → invalidateOnDataChange(pacienteId, 'medicacion')
- Nuevo laboratorio → invalidateOnDataChange(pacienteId, 'laboratorio')
```

### Proceso de Invalidación

```typescript
1. Detectar cambio de datos (ej: nueva comida)
2. Invalidar tags de Next.js/Cloudflare:
   - `ai-suggestions-${pacienteId}`
   - `patient-${pacienteId}`
3. Eliminar keys de Redis relacionadas
4. Próxima request regenera el caché
```

## Validación por Hash

El sistema usa hashing SHA-256 para detectar cambios en los datos:

```typescript
const payload = {
  comidas: [...],
  glucosa: [...],
  habitos: [...],
  // ... todos los datos relevantes
};

const hash = SHA256(stableSerialize(payload));

// Si el hash cambió → regenerar sugerencias
// Si el hash es igual → usar caché
```

## Configuración

### Variables de Entorno

```env
# Redis/Upstash (opcional)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Si no están configuradas, el sistema funciona sin Redis
# usando solo Cloudflare CDN + DB
```

### Ajustar Tiempos de Caché

```typescript
// src/app/resumen/page.tsx
export const revalidate = 300; // 5 minutos (Cloudflare)

// src/components/resumen/AiSuggestions.tsx
intelligentCache(key, fetcher, {
  revalidate: 3600, // 1 hora (Redis)
  tags: [...]
});
```

## Streaming con Suspense

La página usa React Suspense para mejorar la percepción de velocidad:

```typescript
// La página carga inmediatamente con datos básicos
<Suspense fallback={<AiSuggestionsLoading />}>
  <AiSuggestions /> // Se carga en segundo plano
</Suspense>
```

### Beneficios del Streaming

1. **Time to First Byte (TTFB)**: ~50-200ms
2. **First Contentful Paint (FCP)**: ~200-500ms
3. **Sugerencias de IA**: Aparecen después sin bloquear

## Métricas de Rendimiento

### Antes de la Optimización
- Primera carga: 5-15 segundos
- Carga con caché DB: 2-5 segundos
- Bloqueo total hasta que termine la IA

### Después de la Optimización

#### Primera Carga (Cache MISS completo)
- Datos básicos: 200-500ms
- Sugerencias IA: +3-10s (streaming)
- Total percibido: ~500ms

#### Segunda Carga (Cache HIT en Cloudflare)
- Página completa: 10-50ms
- Sin consultas a DB ni IA

#### Tercera Carga (Cache HIT en Redis)
- Página completa: 50-100ms
- Sin consultas a DB ni IA

#### Con Datos Nuevos (Cache invalidado)
- Datos básicos: 200-500ms (desde DB)
- Sugerencias IA: +3-10s (regeneración)
- Próxima carga: 10-50ms (Cloudflare)

## Resiliencia

El sistema es resiliente a fallos:

```typescript
// Si Redis falla → usa DB directamente
// Si DB falla → usa caché antiguo de Redis
// Si IA falla → usa caché antiguo de DB
// Si todo falla → muestra mensaje de fallback
```

## Monitoreo

Para monitorear el rendimiento del caché:

```typescript
// Logs automáticos en consola:
console.log(`Cache invalidated for patient: ${pacienteId}`);
console.log(`Data change detected: ${dataType}`);
console.error('Failed to invalidate Redis cache:', error);
```

## Mejores Prácticas

1. **No invalidar manualmente** - Usa `invalidateOnDataChange()`
2. **Ajustar tiempos según uso** - Más tráfico = más caché
3. **Monitorear Redis** - Verificar que esté funcionando
4. **Probar sin Redis** - El sistema debe funcionar igual

## Archivos Modificados

```
src/
├── app/resumen/page.tsx              # Agregado revalidate + Suspense
├── components/resumen/
│   ├── AiSuggestions.tsx             # Componente con caché multinivel
│   └── AiSuggestionsLoading.tsx      # Skeleton loader
├── lib/
│   ├── redis.ts                      # intelligentCache() existente
│   └── cache-invalidation.ts         # Nuevas funciones de invalidación
└── actions/
    ├── comida.ts                     # Agregada invalidación
    ├── glucosa.ts                    # Agregada invalidación
    ├── habitos.ts                    # Agregada invalidación
    └── laboratorio.ts                # Agregada invalidación
```

## Testing

Para probar el sistema de caché:

```bash
# 1. Primera carga (debería tardar 3-10s)
curl https://tu-app.com/resumen

# 2. Segunda carga (debería tardar <50ms)
curl https://tu-app.com/resumen

# 3. Agregar nueva comida
# POST /api/comidas

# 4. Tercera carga (debería regenerar caché)
curl https://tu-app.com/resumen
```
