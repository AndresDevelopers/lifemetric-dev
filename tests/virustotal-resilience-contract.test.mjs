import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.join(process.cwd(), '.env.example');
const readmePath = path.join(process.cwd(), 'README.md');
const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'security', 'scan-file', 'route.ts');

const envExample = fs.readFileSync(envPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');

test('env example documents VirusTotal key', () => {
  assert.match(envExample, /VIRUSTOTAL_API_KEY=""/);
  assert.match(envExample, /MAINTENANCE_JOB_TOKEN=/);
});

test('readme documents resilient anti-malware flow', () => {
  assert.match(readme, /Escaneo anti-malware en subida de archivos/);
  assert.match(readme, /modo resiliente/i);
});

test('scan route keeps resilient fallback when API key is missing or API fails', () => {
  assert.match(route, /if \(!apiKey\)/);
  assert.match(route, /mode: "skipped"/);
  assert.match(route, /toUserMessage\(locale, "fallback"\)/);
});
