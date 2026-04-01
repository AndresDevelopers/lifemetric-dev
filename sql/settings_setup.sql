-- Lifemetric: setup actualizado para avatar/perfil
-- Reemplaza el script legacy que apuntaba a tablas "Paciente"/"paciente".

BEGIN;

ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 5242880)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatars son publicos" ON storage.objects;
DROP POLICY IF EXISTS "Avatars son públicos" ON storage.objects;
DROP POLICY IF EXISTS "Avatars son pÃºblicos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden subir sus propios avatars" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar sus avatars" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden eliminar sus propios avatars" ON storage.objects;

CREATE POLICY "Avatars son publicos" ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Usuarios pueden subir sus propios avatars" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Usuarios pueden actualizar sus avatars" ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Usuarios pueden eliminar sus propios avatars" ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars');

COMMIT;
