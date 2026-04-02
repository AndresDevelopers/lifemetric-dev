import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const schemaSqlPath = path.join(process.cwd(), 'sql', '01_schema_tables.sql');
const storageSqlPath = path.join(process.cwd(), 'sql', '02_storage_buckets.sql');
const mealActionPath = path.join(process.cwd(), 'src', 'actions', 'comida.ts');
const schema = fs.readFileSync(schemaPath, 'utf8');
const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
const storageSql = fs.readFileSync(storageSqlPath, 'utf8');
const mealAction = fs.readFileSync(mealActionPath, 'utf8');

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
  assert.match(storageSql, /VALUES \('avatars', 'avatars', true, 5242880\)/);
  assert.match(storageSql, /VALUES \('laboratorios', 'laboratorios', false, 10485760\)/);
  assert.match(storageSql, /VALUES \('medicina', 'medicina', false, 10485760\)/);
  assert.match(storageSql, /VALUES \('comidas', 'comidas', false, 10485760\)/);
  assert.match(storageSql, /CREATE POLICY avatars_public_read/);
  assert.match(storageSql, /CREATE POLICY laboratorios_all_access/);
});
