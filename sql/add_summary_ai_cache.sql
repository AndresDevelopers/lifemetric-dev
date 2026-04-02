-- ============================================
-- Cache persistente para sugerencias IA del Resumen
-- Ejecutar en PostgreSQL (Supabase)
-- ============================================

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

CREATE INDEX IF NOT EXISTS idx_summary_ai_cache_paciente_updated_at
  ON summary_ai_cache (paciente_id, updated_at DESC);

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
