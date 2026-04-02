import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const retentionSqlPath = path.join(process.cwd(), 'sql', 'account_retention_and_registration_fields.sql');
const summaryAiCacheSqlPath = path.join(process.cwd(), 'sql', 'add_summary_ai_cache.sql');
const mealActionPath = path.join(process.cwd(), 'src', 'actions', 'comida.ts');
const schema = fs.readFileSync(schemaPath, 'utf8');
const retentionSql = fs.readFileSync(retentionSqlPath, 'utf8');
const summaryAiCacheSql = fs.readFileSync(summaryAiCacheSqlPath, 'utf8');
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
  assert.match(retentionSql, /producto_permitido_registro/);
  assert.match(retentionSql, /doctor_asignado/);
  assert.match(retentionSql, /last_login_at/);
  assert.match(retentionSql, /deactivated_at/);
  assert.match(retentionSql, /inactivity_notification_sent_at/);
});

test('meal action stays aligned with Prisma comida field names', () => {
  assert.match(schema, /clasificacion_carbohidrato\s+String\?/);
  assert.match(mealAction, /clasificacion_carbohidrato:\s*class_carbohidrato/);
  assert.doesNotMatch(mealAction, /clasificacion_carbidrato/);
});

test('summary ai cache SQL includes table, unique key and RLS policies', () => {
  assert.match(summaryAiCacheSql, /CREATE TABLE IF NOT EXISTS summary_ai_cache/);
  assert.match(summaryAiCacheSql, /UNIQUE\s+\(paciente_id,\s*locale,\s*range_from,\s*range_to\)/);
  assert.match(summaryAiCacheSql, /ALTER TABLE summary_ai_cache ENABLE ROW LEVEL SECURITY/);
  assert.match(summaryAiCacheSql, /CREATE POLICY summary_ai_cache_select_own/);
});
