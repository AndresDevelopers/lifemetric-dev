-- Agrega hora al registro de hábitos para guardar fecha + hora exacta.
ALTER TABLE habitos
ADD COLUMN IF NOT EXISTS hora TIME;
