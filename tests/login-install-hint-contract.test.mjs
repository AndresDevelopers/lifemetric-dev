import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const loginPath = path.join(process.cwd(), 'src', 'app', 'login', 'page.tsx');
const pwaInstallPromptPath = path.join(process.cwd(), 'src', 'lib', 'pwaInstallPrompt.ts');
const readmePath = path.join(process.cwd(), 'README.md');

const loginSource = fs.readFileSync(loginPath, 'utf8');
const pwaInstallPromptSource = fs.readFileSync(pwaInstallPromptPath, 'utf8');
const readmeSource = fs.readFileSync(readmePath, 'utf8');

test('login page renders install hint gate on mobile devices', () => {
  assert.match(loginSource, /showInstallHint/);
  assert.match(loginSource, /shouldShowPwaInstallHint/);
  assert.match(loginSource, /Install this app for quick access from your home screen/);
});

test('PWA hint logic excludes Google Chrome on Android and hides in standalone mode', () => {
  assert.match(pwaInstallPromptSource, /isGoogleChromeOnAndroid/);
  assert.match(pwaInstallPromptSource, /isAppRunningStandalone/);
  assert.match(pwaInstallPromptSource, /!isGoogleChromeOnAndroid/);
});

test('README documents login install hint behavior', () => {
  assert.match(readmeSource, /login/i);
  assert.match(readmeSource, /Google Chrome en Android/i);
  assert.match(readmeSource, /install hint/i);
});
