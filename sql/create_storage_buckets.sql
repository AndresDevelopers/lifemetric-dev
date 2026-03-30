-- ============================================================
-- CREACIÓN DE BUCKETS EN SUPABASE STORAGE
-- Ejecutar en SQL Editor de Supabase Dashboard
-- ============================================================

-- Crear bucket para LABORATORIOS
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('laboratorios', 'laboratorios', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Crear bucket para MEDICINA
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('medicina', 'medicina', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Crear bucket para COMIDAS (fotos de comidas)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comidas', 'comidas', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- POLÍTICAS DE ACCESO (RLS)
-- La app usa cookies propias, no sesiones de Supabase Auth
-- Por eso usamos políticas que permiten acceso público autenticado
-- ============================================================

-- Policies para LABORATORIOS (acceso total para INSERT/SELECT/UPDATE/DELETE)
DROP POLICY IF EXISTS "Public access to laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update to laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from laboratorios" ON storage.objects;

CREATE POLICY "Allow all access to laboratoriums" ON storage.objects
FOR ALL 
USING (bucket_id = 'laboratorios')
WITH CHECK (bucket_id = 'laboratorios');

-- Policies para MEDICINA (acceso total)
DROP POLICY IF EXISTS "Public access to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from medicina" ON storage.objects;

CREATE POLICY "Allow all access to medicina" ON storage.objects
FOR ALL 
USING (bucket_id = 'medicina')
WITH CHECK (bucket_id = 'medicina');

-- Policies para COMIDAS (acceso total)
DROP POLICY IF EXISTS "Public access to comidas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to comidas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update to comidas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from comidas" ON storage.objects;

CREATE POLICY "Allow all access to comidas" ON storage.objects
FOR ALL 
USING (bucket_id = 'comidas')
WITH CHECK (bucket_id = 'comidas');

-- Verificar buckets creados
-- SELECT * FROM storage.buckets;