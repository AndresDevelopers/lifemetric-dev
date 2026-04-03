import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const schemaSqlPath = path.join(process.cwd(), 'sql', '01_schema_tables.sql');
const storageSqlPath = path.join(process.cwd(), 'sql', '02_storage_buckets.sql');
const syncSqlPath = path.join(process.cwd(), 'sql', '03_sync_existing_supabase.sql');
const sqlReadmePath = path.join(process.cwd(), 'sql', 'README.md');
const mealActionPath = path.join(process.cwd(), 'src', 'actions', 'comida.ts');
const settingsPagePath = path.join(process.cwd(), 'src', 'app', 'ajustes', 'page.tsx');
const medicationPagePath = path.join(process.cwd(), 'src', 'app', 'medicacion', 'nuevo', 'page.tsx');
const labPagePath = path.join(process.cwd(), 'src', 'app', 'laboratorios', 'nuevo', 'page.tsx');
const uploadFileTypesPath = path.join(process.cwd(), 'src', 'lib', 'uploadFileTypes.ts');
const schema = fs.readFileSync(schemaPath, 'utf8');
const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
const storageSql = fs.readFileSync(storageSqlPath, 'utf8');
const syncSql = fs.readFileSync(syncSqlPath, 'utf8');
const sqlReadme = fs.readFileSync(sqlReadmePath, 'utf8');
const mealAction = fs.readFileSync(mealActionPath, 'utf8');
const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const medicationPage = fs.readFileSync(medicationPagePath, 'utf8');
const labPage = fs.readFileSync(labPagePath, 'utf8');
const uploadFileTypes = fs.readFileSync(uploadFileTypesPath, 'utf8');

test('schema maps Paciente to pacientes table', () => {
  assert.match(schema, /model\s+Paciente\s+\{[\s\S]*?@@map\("pacientes"\)/m);
});

test('schema includes summary relations used by the dashboard', () => {
  assert.match(schema, /laboratorios\s+Laboratorio\[\]/);
  assert.match(schema, /medicacion\s+RegistroMedicacion\[\]/);
  assert.match(schema, /sueno_horas\s+Decimal\?/);
  assert.doesNotMatch(schema, /sueno_inicial_h/);
  assert.match(schema, /model\s+Laboratorio\s+\{[\s\S]*?@@map\("laboratorios"\)/m);
  assert.match(schema, /resultados_detectados\s+Json\?/);
  assert.match(schema, /model\s+RegistroMedicacion\s+\{[\s\S]*?@@map\("medicacion"\)/m);
  assert.match(schema, /model\s+SummaryAiCache\s+\{/);
  assert.match(schema, /summary_ai_cache\s+SummaryAiCache\[\]/);
  assert.match(schema, /@@map\("summary_ai_cache"\)/);
});

test('sql migration script includes inactivity/login and registration extension fields', () => {
  assert.match(schemaSql, /producto_permitido_registro/);
  assert.match(schemaSql, /doctor_asignado/);
  assert.match(schemaSql, /last_login_at/);
  assert.match(schemaSql, /deactivated_at/);
  assert.match(schemaSql, /inactivity_notification_sent_at/);
});

test('schema SQL includes defensive database constraints aligned with app validation', () => {
  assert.match(schemaSql, /pacientes_edad_chk/);
  assert.match(schemaSql, /pacientes_altura_cm_chk/);
  assert.match(schemaSql, /comidas_tipo_comida_chk/);
  assert.match(schemaSql, /glucosa_tipo_glucosa_chk/);
  assert.match(schemaSql, /glucosa_valor_glucosa_chk/);
  assert.match(schemaSql, /medicacion_estado_toma_chk/);
  assert.match(schemaSql, /laboratorios_non_negative_values_chk/);
  assert.match(schemaSql, /summary_ai_cache_range_chk/);
});

test('meal action stays aligned with Prisma comida field names', () => {
  assert.match(schema, /clasificacion_carbohidrato\s+String\?/);
  assert.match(mealAction, /clasificacion_carbohidrato:\s*class_carbohidrato/);
  assert.doesNotMatch(mealAction, /clasificacion_carbidrato/);
});

test('summary ai cache SQL includes table, unique key and RLS policies', () => {
  assert.match(schemaSql, /CREATE TABLE IF NOT EXISTS summary_ai_cache/);
  assert.match(schemaSql, /UNIQUE\s+\(paciente_id,\s*locale,\s*range_from,\s*range_to\)/);
  assert.match(schemaSql, /ALTER TABLE summary_ai_cache ENABLE ROW LEVEL SECURITY/);
  assert.match(schemaSql, /CREATE POLICY summary_ai_cache_select_own/);
});

test('storage SQL keeps consolidated buckets and avatar policies', () => {
  assert.match(storageSql, /VALUES \('avatars', 'avatars', true, 20971520\)/);
  assert.match(storageSql, /VALUES \('logo', 'logo', true, 5242880\)/);
  assert.match(storageSql, /VALUES \('laboratorios', 'laboratorios', false, 20971520\)/);
  assert.match(storageSql, /VALUES \('medicina', 'medicina', false, 20971520\)/);
  assert.match(storageSql, /VALUES \('comidas', 'comidas', true, 20971520\)/);
  assert.match(storageSql, /CREATE OR REPLACE FUNCTION public\.is_valid_storage_object_name/);
  assert.match(storageSql, /\^avatars\/\[0-9a-f-\]\{36\}/);
  assert.match(storageSql, /\^medicacion\/\[0-9a-f-\]\{36\}/);
  assert.match(storageSql, /\^laboratorios\/\[0-9a-f-\]\{36\}/);
  assert.match(storageSql, /image\/heic/);
  assert.match(storageSql, /image\/heif/);
  assert.match(storageSql, /image\/raw/);
  assert.match(storageSql, /image\/x-adobe-dng/);
  assert.match(storageSql, /application\/pdf/);
  assert.match(storageSql, /CREATE POLICY avatars_public_read/);
  assert.match(storageSql, /CREATE POLICY logo_public_read/);
  assert.match(storageSql, /CREATE POLICY comidas_public_read/);
  assert.match(storageSql, /CREATE POLICY medicina_public_read/);
  assert.match(storageSql, /CREATE POLICY laboratorios_public_read/);
  assert.doesNotMatch(storageSql, /CREATE POLICY logo_insert/);
});

test('sync SQL keeps existing Supabase projects aligned with schema and storage protections', () => {
  assert.match(syncSql, /CREATE TABLE IF NOT EXISTS feedback_entries/);
  assert.match(syncSql, /CREATE UNIQUE INDEX IF NOT EXISTS pacientes_email_key/);
  assert.match(syncSql, /NOT VALID/);
  assert.match(syncSql, /CREATE OR REPLACE FUNCTION public\.is_valid_storage_object_name/);
  assert.match(syncSql, /CREATE POLICY laboratorios_insert/);
});

test('sql README documents install and sync usage', () => {
  assert.match(sqlReadme, /01_schema_tables\.sql/);
  assert.match(sqlReadme, /02_storage_buckets\.sql/);
  assert.match(sqlReadme, /03_sync_existing_supabase\.sql/);
});

test('upload helper supports extended image and lab formats', () => {
  assert.match(uploadFileTypes, /heic: 'image\/heic'/);
  assert.match(uploadFileTypes, /heif: 'image\/heif'/);
  assert.match(uploadFileTypes, /raw: 'image\/raw'/);
  assert.match(uploadFileTypes, /dng: 'image\/x-adobe-dng'/);
  assert.match(uploadFileTypes, /pdf: 'application\/pdf'/);
});

test('settings page uploads avatars to the avatars bucket', () => {
  assert.match(settingsPage, /supabase\.storage\.from\('avatars'\)\.upload/);
  assert.match(settingsPage, /supabase\.storage\.from\('avatars'\)\.getPublicUrl/);
  assert.match(settingsPage, /accept=\{IMAGE_UPLOAD_ACCEPT_ATTR\}/);
});

test('food, medication and labs use shared extended upload accept rules', () => {
  assert.match(mealAction, /clasificacion_carbohidrato:\s*class_carbohidrato/);
  assert.match(medicationPage, /accept=\{IMAGE_UPLOAD_ACCEPT_ATTR\}/);
  assert.match(labPage, /accept=\{LAB_UPLOAD_ACCEPT_ATTR\}/);
  assert.match(labPage, /20MB/);
});
