-- Agrega URL de foto en medicación para permitir retención automática.
ALTER TABLE medicacion
ADD COLUMN IF NOT EXISTS foto_url TEXT;
