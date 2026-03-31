import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const lifecyclePath = path.join(process.cwd(), 'src', 'lib', 'accountLifecycle.ts');
const maintenancePath = path.join(process.cwd(), 'src', 'app', 'api', 'maintenance', 'storage-retention', 'route.ts');
const authPath = path.join(process.cwd(), 'src', 'actions', 'auth.ts');
const emailPath = path.join(process.cwd(), 'src', 'lib', 'email.ts');
const i18nPath = path.join(process.cwd(), 'src', 'lib', 'i18n.ts');

const lifecycleSource = fs.readFileSync(lifecyclePath, 'utf8');
const maintenanceSource = fs.readFileSync(maintenancePath, 'utf8');
const authSource = fs.readFileSync(authPath, 'utf8');
const emailSource = fs.readFileSync(emailPath, 'utf8');
const i18nSource = fs.readFileSync(i18nPath, 'utf8');

test('account lifecycle helper enforces 12-month deactivation and 3-month deletion grace period', () => {
  assert.match(lifecycleSource, /ACCOUNT_INACTIVITY_DEACTIVATION_DAYS\s*=\s*365/);
  assert.match(lifecycleSource, /ACCOUNT_INACTIVITY_DELETION_GRACE_DAYS\s*=\s*90/);
  assert.match(lifecycleSource, /DELETE FROM feedback_entries/);
  assert.match(lifecycleSource, /tx\.laboratorio\.deleteMany/);
  assert.match(lifecycleSource, /deleteStoragePaths\("laboratorios"/);
});

test('maintenance job deactivates first and only deletes after grace period', () => {
  assert.match(maintenanceSource, /deactivatedInactiveAccounts/);
  assert.match(maintenanceSource, /markPacienteAsInactive/);
  assert.match(maintenanceSource, /permanentlyDeletePacienteAccount/);
  assert.match(maintenanceSource, /ACCOUNT_INACTIVITY_DELETION_GRACE_DAYS/);
});

test('login blocks deactivated accounts with a dedicated inactivity message', () => {
  assert.match(authSource, /findLifecyclePacienteByEmail/);
  assert.match(authSource, /authMessages\.accountInactive/);
  assert.match(i18nSource, /accountInactive:/);
});

test('deactivation email warns about automatic deletion after 3 months', () => {
  assert.match(emailSource, /sendAccountDeactivatedEmail/);
  assert.match(emailSource, /3 months/);
});
