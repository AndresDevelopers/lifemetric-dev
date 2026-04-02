import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
const manifestPath = path.join(process.cwd(), 'src', 'app', 'manifest.ts');
const registrarPath = path.join(process.cwd(), 'src', 'components', 'PwaRegistrar.tsx');
const serviceWorkerPath = path.join(process.cwd(), 'public', 'sw.js');
const assetLinksPath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
const readmePath = path.join(process.cwd(), 'README.md');

const layoutSource = fs.readFileSync(layoutPath, 'utf8');
const manifestSource = fs.readFileSync(manifestPath, 'utf8');
const registrarSource = fs.readFileSync(registrarPath, 'utf8');
const serviceWorkerSource = fs.readFileSync(serviceWorkerPath, 'utf8');
const assetLinksSource = fs.readFileSync(assetLinksPath, 'utf8');
const readmeSource = fs.readFileSync(readmePath, 'utf8');

test('layout advertises web manifest and mounts PWA registrar', () => {
  assert.match(layoutSource, /manifest:\s*"\/manifest\.webmanifest"/);
  assert.match(layoutSource, /<PwaRegistrar\s*\/>/);
});

test('manifest declares standalone PWA metadata and icons', () => {
  assert.match(manifestSource, /display:\s*"standalone"/);
  assert.match(manifestSource, /start_url:\s*"\/"/);
  assert.match(manifestSource, /theme_color:\s*"#5b67f1"/);
  assert.match(manifestSource, /icons:\s*\[/);
  assert.match(manifestSource, /getPublicAppFaviconUrl/);
  assert.match(manifestSource, /src:\s*appFaviconUrl/);
});



test('layout metadata uses public app branding env helpers', () => {
  assert.match(layoutSource, /getPublicAppName/);
  assert.match(layoutSource, /getPublicAppFaviconUrl/);
});
test('service worker enables app-shell caching', () => {
  assert.match(registrarSource, /const SERVICE_WORKER_PATH = "\/sw\.js"/);
  assert.match(registrarSource, /navigator\.serviceWorker\.register\(SERVICE_WORKER_PATH/);
  assert.match(serviceWorkerSource, /const CACHE_VERSION = "lifemetric-pwa-v2"/);
  assert.match(serviceWorkerSource, /self\.addEventListener\("install"/);
  assert.match(serviceWorkerSource, /self\.addEventListener\("fetch"/);
  assert.match(serviceWorkerSource, /isNavigationRequest/);
  assert.match(serviceWorkerSource, /isCacheableStaticAsset/);
  assert.match(serviceWorkerSource, /event\.request\.mode === "navigate"/);
  assert.match(serviceWorkerSource, /if \(!isStaticAsset\) \{\s*return;\s*\}/);
});



test('Android asset links endpoint exists and returns valid JSON array', () => {
  const parsed = JSON.parse(assetLinksSource);
  assert.ok(Array.isArray(parsed));
});
test('README documents the new PWA support', () => {
  assert.match(readmeSource, /## PWA/);
  assert.match(readmeSource, /manifest web/i);
  assert.match(readmeSource, /service worker/i);
});
