-- Lifemetric consolidated schema setup.
-- Includes extensions, core tables, additive columns, indexes,
-- data backfills, triggers and app-level RLS policies.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pacientes (
  paciente_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  edad INTEGER NOT NULL,
  sexo TEXT NOT NULL,
  diagnostico_principal TEXT NOT NULL,
  usa_glucometro BOOLEAN NOT NULL DEFAULT false,
  medicacion_base TEXT,
  peso_inicial_kg NUMERIC(5, 2),
  cintura_inicial_cm NUMERIC(5, 2),
  objetivo_clinico TEXT,
  fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  newsletter_suscrito BOOLEAN NOT NULL DEFAULT TRUE,
  idioma TEXT NOT NULL DEFAULT 'es',
  fecha_nacimiento DATE,
  avatar_url TEXT,
  altura_cm NUMERIC(5, 2),
  motivo_registro TEXT,
  producto_permitido_registro TEXT,
  doctor_asignado TEXT,
  last_login_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  inactivity_notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS peso_inicial_kg NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS cintura_inicial_cm NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS newsletter_suscrito BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS idioma TEXT NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS motivo_registro TEXT,
  ADD COLUMN IF NOT EXISTS producto_permitido_registro TEXT,
  ADD COLUMN IF NOT EXISTS doctor_asignado TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivity_notification_sent_at TIMESTAMPTZ;

UPDATE pacientes
SET
  newsletter_suscrito = COALESCE(newsletter_suscrito, TRUE),
  idioma = CASE
    WHEN idioma IN ('es', 'en') THEN idioma
    ELSE 'es'
  END
WHERE newsletter_suscrito IS NULL
   OR idioma IS NULL
   OR idioma NOT IN ('es', 'en');

UPDATE pacientes
SET motivo_registro = diagnostico_principal
WHERE (motivo_registro IS NULL OR motivo_registro = '')
  AND diagnostico_principal IS NOT NULL
  AND diagnostico_principal <> '';

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_idioma_chk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_idioma_chk
      CHECK (idioma IN ('es', 'en'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_edad_chk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_edad_chk
      CHECK (edad BETWEEN 1 AND 130);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_altura_cm_chk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_altura_cm_chk
      CHECK (altura_cm IS NULL OR altura_cm BETWEEN 80 AND 272);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_peso_inicial_kg_chk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_peso_inicial_kg_chk
      CHECK (peso_inicial_kg IS NULL OR (peso_inicial_kg > 0 AND peso_inicial_kg <= 500));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pacientes_cintura_inicial_cm_chk'
  ) THEN
    ALTER TABLE pacientes
      ADD CONSTRAINT pacientes_cintura_inicial_cm_chk
      CHECK (cintura_inicial_cm IS NULL OR (cintura_inicial_cm > 0 AND cintura_inicial_cm <= 300));
  END IF;
END $$;

COMMENT ON COLUMN pacientes.peso_inicial_kg IS
  'Peso inicial del paciente al momento del registro o inicio de tratamiento';
COMMENT ON COLUMN pacientes.cintura_inicial_cm IS
  'Medida de cintura inicial del paciente para seguimiento evolutivo';

CREATE TABLE IF NOT EXISTS comidas (
  comida_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo_comida TEXT NOT NULL,
  foto_url TEXT,
  nota TEXT,
  alimento_principal TEXT,
  kcal_estimadas INTEGER,
  proteina_g NUMERIC(5, 2),
  carbohidratos_g NUMERIC(5, 2),
  grasa_g NUMERIC(5, 2),
  fibra_g NUMERIC(5, 2),
  clasificacion_proteina TEXT,
  clasificacion_carbohidrato TEXT,
  clasificacion_fibra TEXT,
  clasificacion_final TEXT,
  razon_inadecuada TEXT,
  alternativa_saludable TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE comidas
  ADD COLUMN IF NOT EXISTS razon_inadecuada TEXT,
  ADD COLUMN IF NOT EXISTS alternativa_saludable TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comidas_tipo_comida_chk'
  ) THEN
    ALTER TABLE comidas
      ADD CONSTRAINT comidas_tipo_comida_chk
      CHECK (tipo_comida IN ('Desayuno', 'Comida', 'Cena', 'Colacion'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comidas_macros_non_negative_chk'
  ) THEN
    ALTER TABLE comidas
      ADD CONSTRAINT comidas_macros_non_negative_chk
      CHECK (
        (kcal_estimadas IS NULL OR kcal_estimadas >= 0)
        AND (proteina_g IS NULL OR proteina_g >= 0)
        AND (carbohidratos_g IS NULL OR carbohidratos_g >= 0)
        AND (grasa_g IS NULL OR grasa_g >= 0)
        AND (fibra_g IS NULL OR fibra_g >= 0)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS habitos (
  habito_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora TIME,
  sueno_horas NUMERIC(4, 2),
  agua_vasos INTEGER,
  ejercicio_min INTEGER,
  pa_sistolica INTEGER,
  pa_diastolica INTEGER,
  pulso INTEGER,
  peso_kg NUMERIC(5, 2),
  cintura_cm NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE habitos
  ADD COLUMN IF NOT EXISTS hora TIME,
  ADD COLUMN IF NOT EXISTS cintura_cm NUMERIC(5, 2);

COMMENT ON COLUMN habitos.cintura_cm IS
  'Medida de cintura diaria o recurrente del paciente';

CREATE TABLE IF NOT EXISTS glucosa (
  glucosa_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo_glucosa TEXT NOT NULL,
  valor_glucosa INTEGER NOT NULL,
  comida_relacionada_id UUID REFERENCES comidas(comida_id) ON DELETE SET NULL,
  delta_glucosa INTEGER,
  clasificacion_glucosa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'glucosa_tipo_glucosa_chk'
  ) THEN
    ALTER TABLE glucosa
      ADD CONSTRAINT glucosa_tipo_glucosa_chk
      CHECK (tipo_glucosa IN ('ayuno', 'antes_comer', 'antes_cena', '1h_post'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'glucosa_valor_glucosa_chk'
  ) THEN
    ALTER TABLE glucosa
      ADD CONSTRAINT glucosa_valor_glucosa_chk
      CHECK (valor_glucosa BETWEEN 20 AND 600);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS medicacion (
  registro_medicacion_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  medicamento TEXT NOT NULL,
  dosis TEXT NOT NULL,
  estado_toma TEXT NOT NULL,
  comentarios TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE medicacion
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'medicacion_estado_toma_chk'
  ) THEN
    ALTER TABLE medicacion
      ADD CONSTRAINT medicacion_estado_toma_chk
      CHECK (estado_toma IN ('tomada', 'olvidada', 'omitida_por_efecto', 'retrasada'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS laboratorios (
  laboratorio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha_estudio DATE NOT NULL,
  hba1c NUMERIC(4, 2),
  glucosa_ayuno INTEGER,
  insulina NUMERIC(5, 2),
  trigliceridos INTEGER,
  hdl INTEGER,
  ldl INTEGER,
  alt INTEGER,
  ast INTEGER,
  tsh NUMERIC(5, 2),
  pcr_us NUMERIC(5, 2),
  creatinina NUMERIC(5, 2),
  acido_urico NUMERIC(5, 2),
  archivo_url TEXT,
  resultados_detectados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE laboratorios
  ADD COLUMN IF NOT EXISTS insulina NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS alt INTEGER,
  ADD COLUMN IF NOT EXISTS ast INTEGER,
  ADD COLUMN IF NOT EXISTS tsh NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS creatinina NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS acido_urico NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS pcr_us NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS resultados_detectados JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'laboratorios_non_negative_values_chk'
  ) THEN
    ALTER TABLE laboratorios
      ADD CONSTRAINT laboratorios_non_negative_values_chk
      CHECK (
        (hba1c IS NULL OR hba1c >= 0)
        AND (glucosa_ayuno IS NULL OR glucosa_ayuno >= 0)
        AND (insulina IS NULL OR insulina >= 0)
        AND (trigliceridos IS NULL OR trigliceridos >= 0)
        AND (hdl IS NULL OR hdl >= 0)
        AND (ldl IS NULL OR ldl >= 0)
        AND (alt IS NULL OR alt >= 0)
        AND (ast IS NULL OR ast >= 0)
        AND (tsh IS NULL OR tsh >= 0)
        AND (pcr_us IS NULL OR pcr_us >= 0)
        AND (creatinina IS NULL OR creatinina >= 0)
        AND (acido_urico IS NULL OR acido_urico >= 0)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS summary_ai_cache (
  cache_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('es', 'en')),
  range_from DATE NOT NULL,
  range_to DATE NOT NULL,
  payload_hash TEXT NOT NULL,
  suggestions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paciente_id, locale, range_from, range_to)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'summary_ai_cache_range_chk'
  ) THEN
    ALTER TABLE summary_ai_cache
      ADD CONSTRAINT summary_ai_cache_range_chk
      CHECK (range_from <= range_to);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS feedback_entries (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES pacientes(paciente_id) ON DELETE SET NULL,
  paciente_email TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('error', 'suggestion')),
  asunto TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_email_key
  ON pacientes (email);

CREATE INDEX IF NOT EXISTS idx_pacientes_last_login_at
  ON pacientes (last_login_at);

CREATE INDEX IF NOT EXISTS idx_pacientes_deactivated_at
  ON pacientes (deactivated_at);

CREATE INDEX IF NOT EXISTS idx_comidas_created_at
  ON comidas (created_at);

CREATE INDEX IF NOT EXISTS idx_laboratorios_created_at
  ON laboratorios (created_at);

CREATE INDEX IF NOT EXISTS idx_summary_ai_cache_paciente_updated_at
  ON summary_ai_cache (paciente_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_created_at
  ON feedback_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_paciente_id
  ON feedback_entries (paciente_id);

CREATE OR REPLACE FUNCTION set_summary_ai_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_summary_ai_cache_updated_at ON summary_ai_cache;
CREATE TRIGGER trg_summary_ai_cache_updated_at
BEFORE UPDATE ON summary_ai_cache
FOR EACH ROW
EXECUTE FUNCTION set_summary_ai_cache_updated_at();

ALTER TABLE summary_ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS summary_ai_cache_select_own ON summary_ai_cache;
CREATE POLICY summary_ai_cache_select_own
ON summary_ai_cache
FOR SELECT
USING (paciente_id = auth.uid());

DROP POLICY IF EXISTS summary_ai_cache_insert_own ON summary_ai_cache;
CREATE POLICY summary_ai_cache_insert_own
ON summary_ai_cache
FOR INSERT
WITH CHECK (paciente_id = auth.uid());

DROP POLICY IF EXISTS summary_ai_cache_update_own ON summary_ai_cache;
CREATE POLICY summary_ai_cache_update_own
ON summary_ai_cache
FOR UPDATE
USING (paciente_id = auth.uid())
WITH CHECK (paciente_id = auth.uid());

DROP FUNCTION IF EXISTS public.authenticate_paciente(TEXT, TEXT);

COMMIT;
