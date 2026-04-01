-- Actualización de la tabla pacientes para registrar métricas iniciales (Peso y Cintura)
-- Fecha: 2026-04-01
-- Objetivo: Permitir el seguimiento evolutivo desde el punto inicial en la página de Resumen.

ALTER TABLE pacientes 
ADD COLUMN IF NOT EXISTS peso_inicial_kg NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS cintura_inicial_cm NUMERIC(5,2);

-- Comentarios descriptivos para la base de datos
COMMENT ON COLUMN pacientes.peso_inicial_kg IS 'Peso inicial del paciente al momento del registro o inicio de tratamiento';
COMMENT ON COLUMN pacientes.cintura_inicial_cm IS 'Medida de cintura inicial del paciente para seguimiento evolutivo';

-- Seguimiento evolutivo diario de cintura en hábitos
ALTER TABLE habitos
ADD COLUMN IF NOT EXISTS cintura_cm NUMERIC(5,2);

COMMENT ON COLUMN habitos.cintura_cm IS 'Medida de cintura diaria o recurrente del paciente';
