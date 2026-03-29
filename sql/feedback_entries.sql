-- Lifemetric manual SQL: Feedback inbox table
-- Ejecuta este script en tu base de datos para habilitar el flujo de feedback.

CREATE TABLE IF NOT EXISTS feedback_entries (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES pacientes(paciente_id) ON DELETE SET NULL,
  paciente_email TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('error', 'suggestion')),
  asunto TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_created_at
  ON feedback_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_paciente_id
  ON feedback_entries (paciente_id);
