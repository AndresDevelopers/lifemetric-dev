-- Agregar columnas para almacenar la razón de inadecuación y alternativa saludable
-- Tabla: comidas

ALTER TABLE public.comidas 
ADD COLUMN IF NOT EXISTS razon_inadecuada TEXT,
ADD COLUMN IF NOT EXISTS alternativa_saludable TEXT;

-- Verificar que se agregaron correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'comidas' 
AND column_name IN ('razon_inadecuada', 'alternativa_saludable');