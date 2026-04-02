# SQL Scripts

La carpeta `sql` quedo consolidada en scripts idempotentes por responsabilidad.

## Orden de ejecucion

1. `01_schema_tables.sql`
2. `02_storage_buckets.sql`

## Contenido

- `01_schema_tables.sql`: extensiones, tablas base, columnas agregadas historicamente, indices, constraints, backfills, `summary_ai_cache`, `feedback_entries`, trigger y politicas RLS de aplicacion.
- `02_storage_buckets.sql`: buckets de Supabase Storage y sus policies para `avatars`, `laboratorios`, `medicina` y `comidas`.

## Criterio

Los scripts historicos fragmentados se absorbieron en estos archivos para evitar drift, duplicidad y dudas sobre cual ejecutar en entornos nuevos o existentes.
