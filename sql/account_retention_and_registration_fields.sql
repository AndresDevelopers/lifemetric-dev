-- Lifemetric: campos para registro extendido + inactividad + retención
-- Ejecutar en PostgreSQL/Supabase SQL Editor.

BEGIN;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS producto_permitido_registro TEXT,
  ADD COLUMN IF NOT EXISTS doctor_asignado TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivity_notification_sent_at TIMESTAMPTZ;

-- Validar doctor permitido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_doctor_asignado_chk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_doctor_asignado_chk
      CHECK (doctor_asignado IS NULL OR doctor_asignado IN ('Renato', 'Ulysses'));
  END IF;
END $$;

-- Índice para barrido de inactividad anual
CREATE INDEX IF NOT EXISTS idx_pacientes_last_login_at
  ON pacientes (last_login_at);

CREATE INDEX IF NOT EXISTS idx_pacientes_deactivated_at
  ON pacientes (deactivated_at);

-- Índices para jobs de retención de archivos
CREATE INDEX IF NOT EXISTS idx_comidas_created_at
  ON comidas (created_at);

CREATE INDEX IF NOT EXISTS idx_laboratorios_created_at
  ON laboratorios (created_at);

COMMIT;
