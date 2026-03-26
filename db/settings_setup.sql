-- 1. Intentar agregar las columnas a "Paciente" (con mayúscula y comillas por si acaso)
DO $$ 
BEGIN
    -- Intentar con Paciente (mayúscula)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Paciente') THEN
        ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
        ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "fecha_nacimiento" TIMESTAMP WITH TIME ZONE;
    -- Intentar con paciente (minúscula)
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'paciente') THEN
        ALTER TABLE "paciente" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
        ALTER TABLE "paciente" ADD COLUMN IF NOT EXISTS "fecha_nacimiento" TIMESTAMP WITH TIME ZONE;
    ELSE
        RAISE NOTICE 'La tabla Paciente no se encontró. Asegúrate de haber corrido las migraciones iniciales.';
    END IF;
END $$;

-- 2. Crear el Bucket de Almacenamiento llamado 'avatars'
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Seguridad (Copia esto tal cual)
CREATE POLICY "Avatars son públicos" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Usuarios pueden subir sus propios avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Usuarios pueden actualizar sus avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');