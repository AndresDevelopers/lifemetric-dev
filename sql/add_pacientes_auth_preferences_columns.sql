-- Lifemetric: columnas faltantes para autenticacion/preferencias del paciente
-- Alinea la base de datos con lo que usan src/actions/auth.ts y src/actions/data.ts.

BEGIN;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS newsletter_suscrito BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS idioma TEXT NOT NULL DEFAULT 'es';

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

COMMIT;
