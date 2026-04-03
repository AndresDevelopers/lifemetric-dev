-- Lifemetric consolidated storage setup.
-- Storage remains compatible with the current app flow:
-- public URLs are still used by the frontend, while writes are limited
-- to known folders, allowed extensions and bucket-specific size limits.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 20971520)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('logo', 'logo', true, 5242880)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('laboratorios', 'laboratorios', false, 20971520)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('medicina', 'medicina', false, 20971520)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comidas', 'comidas', true, 20971520)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/raw',
    'image/x-raw',
    'image/x-dcraw',
    'image/x-adobe-dng'
  ]
WHERE id = 'avatars';

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/raw',
    'image/x-raw',
    'image/x-dcraw',
    'image/x-adobe-dng'
  ]
WHERE id = 'logo';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/raw',
    'image/x-raw',
    'image/x-dcraw',
    'image/x-adobe-dng'
  ]
WHERE id = 'laboratorios';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/raw',
    'image/x-raw',
    'image/x-dcraw',
    'image/x-adobe-dng'
  ]
WHERE id = 'medicina';

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/raw',
    'image/x-raw',
    'image/x-dcraw',
    'image/x-adobe-dng'
  ]
WHERE id = 'comidas';

CREATE OR REPLACE FUNCTION public.is_valid_storage_object_name(bucket_name TEXT, object_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE bucket_name
    WHEN 'avatars' THEN object_name ~* '^avatars/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'logo' THEN object_name ~* '^logo/[a-z0-9][a-z0-9/_-]*\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'comidas' THEN object_name ~* '^comidas/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'medicina' THEN object_name ~* '^medicacion/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng)$'
    WHEN 'laboratorios' THEN object_name ~* '^laboratorios/[0-9a-f-]{36}\.(jpe?g|png|heic|heif|raw|dng|pdf)$'
    ELSE FALSE
  END
$$;

DO $$
DECLARE
  storage_policy RECORD;
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    FOR storage_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND (
          policyname LIKE 'Avatars son %'
          OR policyname LIKE 'Usuarios pueden % avatars'
          OR policyname IN (
            'avatars_public_read',
            'avatars_insert',
            'avatars_update',
            'avatars_delete',
            'logo_public_read',
            'comidas_public_read',
            'comidas_insert',
            'comidas_update',
            'comidas_delete',
            'medicina_public_read',
            'medicina_insert',
            'medicina_update',
            'medicina_delete',
            'laboratorios_public_read',
            'laboratorios_insert',
            'laboratorios_update',
            'laboratorios_delete',
            'Public access to laboratorios',
            'Authenticated upload to laboratorios',
            'Authenticated update to laboratorios',
            'Authenticated delete from laboratorios',
            'Public access to medicina',
            'Authenticated upload to medicina',
            'Authenticated update to medicina',
            'Authenticated delete from medicina',
            'Public access to comidas',
            'Authenticated upload to comidas',
            'Authenticated update to comidas',
            'Authenticated delete from comidas',
            'Allow all access to laboratoriums',
            'Allow all access to medicina',
            'Allow all access to comidas',
            'Permitir subida de fotos de comidas',
            'Permitir ver fotos de comidas',
            'Usuarios autenticados pueden actualizar en laboratorios',
            'Usuarios autenticados pueden actualizar en medicina',
            'Usuarios autenticados pueden eliminar de laboratorios',
            'Usuarios autenticados pueden eliminar de medicina',
            'Usuarios autenticados pueden subir a laboratorios',
            'Usuarios autenticados pueden subir a medicina',
            'Usuarios autenticados pueden ver laboratorios',
            'Usuarios autenticados pueden ver medicina',
            'laboratorios_all_access',
            'medicina_all_access',
            'comidas_all_access'
          )
        )
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', storage_policy.policyname);
    END LOOP;

    CREATE POLICY avatars_public_read ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'avatars'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY avatars_insert ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY avatars_update ON storage.objects
    FOR UPDATE
    TO anon, authenticated
    USING (
      bucket_id = 'avatars'
      AND public.is_valid_storage_object_name(bucket_id, name)
    )
    WITH CHECK (
      bucket_id = 'avatars'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY avatars_delete ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (
      bucket_id = 'avatars'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY logo_public_read ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'logo'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY comidas_public_read ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'comidas'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY comidas_insert ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      bucket_id = 'comidas'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY comidas_update ON storage.objects
    FOR UPDATE
    TO anon, authenticated
    USING (
      bucket_id = 'comidas'
      AND public.is_valid_storage_object_name(bucket_id, name)
    )
    WITH CHECK (
      bucket_id = 'comidas'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY comidas_delete ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (
      bucket_id = 'comidas'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY medicina_public_read ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'medicina'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY medicina_insert ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      bucket_id = 'medicina'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY medicina_update ON storage.objects
    FOR UPDATE
    TO anon, authenticated
    USING (
      bucket_id = 'medicina'
      AND public.is_valid_storage_object_name(bucket_id, name)
    )
    WITH CHECK (
      bucket_id = 'medicina'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY medicina_delete ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (
      bucket_id = 'medicina'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY laboratorios_public_read ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'laboratorios'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY laboratorios_insert ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      bucket_id = 'laboratorios'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY laboratorios_update ON storage.objects
    FOR UPDATE
    TO anon, authenticated
    USING (
      bucket_id = 'laboratorios'
      AND public.is_valid_storage_object_name(bucket_id, name)
    )
    WITH CHECK (
      bucket_id = 'laboratorios'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );

    CREATE POLICY laboratorios_delete ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (
      bucket_id = 'laboratorios'
      AND public.is_valid_storage_object_name(bucket_id, name)
    );
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping storage.objects policy sync because the current role is not the owner of storage.objects.';
  END;
END $$;

COMMIT;
