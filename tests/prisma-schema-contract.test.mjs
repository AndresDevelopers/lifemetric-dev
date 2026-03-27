import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

test('schema maps Paciente to pacientes table', () => {
  assert.match(schema, /model\s+Paciente\s+\{[\s\S]*?@@map\("pacientes"\)/m);
});

test('schema includes summary relations used by the dashboard', () => {
  assert.match(schema, /laboratorios\s+Laboratorio\[\]/);
  assert.match(schema, /medicacion\s+RegistroMedicacion\[\]/);
  assert.match(schema, /model\s+Laboratorio\s+\{[\s\S]*?@@map\("laboratorios"\)/m);
  assert.match(schema, /model\s+RegistroMedicacion\s+\{[\s\S]*?@@map\("medicacion"\)/m);
});
