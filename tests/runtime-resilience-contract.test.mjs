import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
const redisPath = path.join(process.cwd(), 'src', 'lib', 'redis.ts');
const turnstilePath = path.join(process.cwd(), 'src', 'components', 'auth', 'TurnstileWidget.tsx');
const readmePath = path.join(process.cwd(), 'README.md');

const layout = fs.readFileSync(layoutPath, 'utf8');
const redis = fs.readFileSync(redisPath, 'utf8');
const turnstile = fs.readFileSync(turnstilePath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');

test('layout avoids hard dependency on @vercel/analytics/react', () => {
  assert.doesNotMatch(layout, /@vercel\/analytics\/react/);
});

test('redis rate limit uses native redis commands without @upstash/ratelimit package', () => {
  assert.doesNotMatch(redis, /@upstash\/ratelimit/);
  assert.match(redis, /redisClient\.incr\(key\)/);
  assert.match(redis, /redisClient\.expire\(key,\s*RATE_LIMIT_WINDOW_SECONDS\)/);
});

test('turnstile fallback does not rely on hardcoded bypass token strings', () => {
  assert.doesNotMatch(turnstile, /bypass-token/);
  assert.match(turnstile, /onRequirementChange\?\.\(false\)/);
});

test('readme documents auth runtime resilience checks', () => {
  assert.match(readme, /Resiliencia de autenticación y runtime/);
  assert.match(readme, /Turnstile no está disponible/i);
});
