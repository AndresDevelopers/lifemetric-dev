-- ============================================
-- SQL para agregar columnas faltantes a la tabla laboratorios
-- Ejecutar en PostgreSQL (Supabase)
-- ============================================

-- Agregar columnas faltantes para laboratorio completo
ALTER TABLE laboratorios
ADD COLUMN IF NOT EXISTS insulina DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS alt INTEGER,
ADD COLUMN IF NOT EXISTS ast INTEGER,
ADD COLUMN IF NOT EXISTS tsh DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS creatinina DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS acido_urico DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS pcr_us DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS resultados_detectados JSONB;

-- Verificar que las columnas se crearon correctamente
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'laboratorios'
ORDER BY ordinal_position;
