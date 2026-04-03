-- Lifemetric sync script for existing Supabase projects.
-- Additive-only alignment for environments that already exist.

BEGIN;

CREATE TABLE IF NOT EXISTS feedback_entries (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES pacientes(paciente_id) ON DELETE SET NULL,
  paciente_email TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('error', 'suggestion')),
  asunto TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS newsletter_suscrito BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS idioma TEXT DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS motivo_registro TEXT,
  ADD COLUMN IF NOT EXISTS producto_permitido_registro TEXT,
  ADD COLUMN IF NOT EXISTS doctor_asignado TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivity_notification_sent_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_email_key
  ON pacientes (LOWER(email))
  WHERE email IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pacientes_idioma_chk') THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_idioma_chk
      CHECK (idioma IN ('es', 'en')) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pacientes_doctor_asignado_chk') THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_doctor_asignado_chk
      CHECK (doctor_asignado IS NULL OR doctor_asignado IN ('Renato', 'Ulysses')) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_storage_object_name(bucket_name TEXT, object_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE bucket_name
    WHEN 'avatars' THEN object_name ~* '^avatars/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'logo' THEN object_name ~* '^logo/[a-z0-9][a-z0-9/_-]*\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'comidas' THEN object_name ~* '^comidas/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'medicina' THEN object_name ~* '^medicacion/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'laboratorios' THEN object_name ~* '^laboratorios/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng|pdf)$'
    ELSE FALSE
  END
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS laboratorios_insert ON storage.objects;
CREATE POLICY laboratorios_insert ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'laboratorios'
  AND public.is_valid_storage_object_name(bucket_id, name)
);

COMMIT;
