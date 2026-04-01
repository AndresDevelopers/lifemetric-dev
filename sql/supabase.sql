-- Supabase Schema para MVP Seguimiento Metabólico

-- Habilitar extensión para UUIDs
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
  peso_inicial_kg DECIMAL(5, 2),
  cintura_inicial_cm DECIMAL(5, 2),
  objetivo_clinico TEXT,
  fecha_alta DATE NOT NULL DEFAULT CURRENT_DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS pacientes_email_key ON pacientes(email);

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
  proteina_g DECIMAL(5, 2),
  carbohidratos_g DECIMAL(5, 2),
  grasa_g DECIMAL(5, 2),
  fibra_g DECIMAL(5, 2),
  clasificacion_proteina TEXT,
  clasificacion_carbohidrato TEXT,
  clasificacion_fibra TEXT,
  clasificacion_final TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS habitos (
  habito_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  sueno_horas DECIMAL(4, 2),
  agua_vasos INTEGER,
  ejercicio_min INTEGER,
  pa_sistolica INTEGER,
  pa_diastolica INTEGER,
  pulso INTEGER,
  peso_kg DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS laboratorios (
  laboratorio_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(paciente_id) ON DELETE CASCADE,
  fecha_estudio DATE NOT NULL,
  hba1c DECIMAL(4, 2),
  glucosa_ayuno INTEGER,
  insulina DECIMAL(5, 2),
  trigliceridos INTEGER,
  hdl INTEGER,
  ldl INTEGER,
  alt INTEGER,
  ast INTEGER,
  tsh DECIMAL(5, 2),
  pcr_us DECIMAL(5, 2),
  creatinina DECIMAL(5, 2),
  acido_urico DECIMAL(5, 2),
  archivo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- La autenticacion actual usa Supabase Auth + Prisma.
-- Eliminamos la funcion legacy si existe para no mantener SQL obsoleto.
DROP FUNCTION IF EXISTS public.authenticate_paciente(TEXT, TEXT);
