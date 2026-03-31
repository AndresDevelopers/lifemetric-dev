-- Adds deleted_at to public.pacientes table to track account deletion timing
-- This is used for delayed data retention policies (e.g., 1-month lab image retention)

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;