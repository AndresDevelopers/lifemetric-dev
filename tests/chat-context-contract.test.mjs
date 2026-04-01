import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const chatActionPath = path.join(process.cwd(), 'src', 'actions', 'chat.ts');
const chatContextPath = path.join(process.cwd(), 'src', 'lib', 'chatContext.ts');
const readmePath = path.join(process.cwd(), 'README.md');

const chatAction = fs.readFileSync(chatActionPath, 'utf8');
const chatContext = fs.readFileSync(chatContextPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');

test('chat action loads full patient history without take limits', () => {
  assert.match(chatAction, /buildPatientChatContext/);
  assert.doesNotMatch(chatAction, /take:\s*\d+/);
  assert.match(chatAction, /DATOS COMPLETOS DEL PACIENTE DISPONIBLES PARA EL CHAT/);
});

test('chat context includes settings profile fields and complete history sections', () => {
  assert.match(chatContext, /Doctor asignado/);
  assert.match(chatContext, /Producto permitido seleccionado/);
  assert.match(chatContext, /Avatar URL/);
  assert.match(chatContext, /otros resultados detectados/);
  assert.match(chatContext, /HISTORIAL COMPLETO DE GLUCOSA/);
  assert.match(chatContext, /HISTORIAL COMPLETO DE HABITOS/);
  assert.match(chatContext, /HISTORIAL COMPLETO DE MEDICACION/);
  assert.match(chatContext, /HISTORIAL COMPLETO DE COMIDAS/);
  assert.match(chatContext, /HISTORIAL COMPLETO DE LABORATORIOS/);
});

test('readme documents full chat access to patient settings and history', () => {
  assert.match(readme, /El widget de chat ahora consume el contexto completo del paciente/i);
  assert.match(readme, /Ajustes/i);
});
