import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const retentionSqlPath = path.join(process.cwd(), 'sql', 'account_retention_and_registration_fields.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
const retentionSql = fs.readFileSync(retentionSqlPath, 'utf8');

test('schema maps Paciente to pacientes table', () => {
  assert.match(schema, /model\s+Paciente\s+\{[\s\S]*?@@map\("pacientes"\)/m);
});

test('schema includes summary relations used by the dashboard', () => {
  assert.match(schema, /laboratorios\s+Laboratorio\[\]/);
  assert.match(schema, /medicacion\s+RegistroMedicacion\[\]/);
  assert.match(schema, /model\s+Laboratorio\s+\{[\s\S]*?@@map\("laboratorios"\)/m);
  assert.match(schema, /model\s+RegistroMedicacion\s+\{[\s\S]*?@@map\("medicacion"\)/m);
});

test('sql migration script includes inactivity/login and registration extension fields', () => {
  assert.match(retentionSql, /producto_permitido_registro/);
  assert.match(retentionSql, /doctor_asignado/);
  assert.match(retentionSql, /last_login_at/);
});
