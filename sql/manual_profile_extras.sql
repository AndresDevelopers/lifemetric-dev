-- Lifemetric: migración manual para extras de perfil en tabla pacientes
-- Ejecutar en tu base de datos PostgreSQL/Supabase.

BEGIN;

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(5,2);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS motivo_registro TEXT;

-- Backfill recomendado:
-- Si no existe motivo_registro, usar diagnostico_principal inicial.
UPDATE pacientes
SET motivo_registro = diagnostico_principal
WHERE (motivo_registro IS NULL OR motivo_registro = '')
  AND diagnostico_principal IS NOT NULL
  AND diagnostico_principal <> '';

COMMIT;
