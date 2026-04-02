-- Lifemetric consolidated storage setup.
-- Includes bucket creation and policies for avatars and evidence uploads.

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 5242880)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('laboratorios', 'laboratorios', false, 10485760)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('medicina', 'medicina', false, 10485760)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('comidas', 'comidas', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  avatar_policy RECORD;
BEGIN
  FOR avatar_policy IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        polname LIKE 'Avatars son %'
        OR polname LIKE 'Usuarios pueden % avatars'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      avatar_policy.polname
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Public access to laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update to laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from laboratorios" ON storage.objects;
DROP POLICY IF EXISTS "Public access to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from medicina" ON storage.objects;
DROP POLICY IF EXISTS "Public access to comidas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to comidas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update to comidas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete from comidas" ON storage.objects;
DROP POLICY IF EXISTS "Allow all access to laboratoriums" ON storage.objects;
DROP POLICY IF EXISTS "Allow all access to medicina" ON storage.objects;
DROP POLICY IF EXISTS "Allow all access to comidas" ON storage.objects;
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
DROP POLICY IF EXISTS avatars_insert ON storage.objects;
DROP POLICY IF EXISTS avatars_update ON storage.objects;
DROP POLICY IF EXISTS avatars_delete ON storage.objects;
DROP POLICY IF EXISTS laboratorios_all_access ON storage.objects;
DROP POLICY IF EXISTS medicina_all_access ON storage.objects;
DROP POLICY IF EXISTS comidas_all_access ON storage.objects;

CREATE POLICY avatars_public_read ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY avatars_insert ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY avatars_update ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY avatars_delete ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars');

CREATE POLICY laboratorios_all_access ON storage.objects
FOR ALL
USING (bucket_id = 'laboratorios')
WITH CHECK (bucket_id = 'laboratorios');

CREATE POLICY medicina_all_access ON storage.objects
FOR ALL
USING (bucket_id = 'medicina')
WITH CHECK (bucket_id = 'medicina');

CREATE POLICY comidas_all_access ON storage.objects
FOR ALL
USING (bucket_id = 'comidas')
WITH CHECK (bucket_id = 'comidas');

COMMIT;
