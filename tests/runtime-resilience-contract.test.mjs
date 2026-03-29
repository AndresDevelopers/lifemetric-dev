import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
const redisPath = path.join(process.cwd(), 'src', 'lib', 'redis.ts');
const turnstilePath = path.join(process.cwd(), 'src', 'components', 'auth', 'TurnstileWidget.tsx');
const authPath = path.join(process.cwd(), 'src', 'actions', 'auth.ts');
const loginPath = path.join(process.cwd(), 'src', 'app', 'login', 'page.tsx');
const sessionPath = path.join(process.cwd(), 'src', 'lib', 'session.ts');
const prismaConfigPath = path.join(process.cwd(), 'prisma.config.ts');
const prismaLibPath = path.join(process.cwd(), 'src', 'lib', 'prisma.ts');
const readmePath = path.join(process.cwd(), 'README.md');

const layout = fs.readFileSync(layoutPath, 'utf8');
const redis = fs.readFileSync(redisPath, 'utf8');
const turnstile = fs.readFileSync(turnstilePath, 'utf8');
const auth = fs.readFileSync(authPath, 'utf8');
const login = fs.readFileSync(loginPath, 'utf8');
const session = fs.readFileSync(sessionPath, 'utf8');
const prismaConfig = fs.readFileSync(prismaConfigPath, 'utf8');
const prismaLib = fs.readFileSync(prismaLibPath, 'utf8');
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
  assert.match(turnstile, /onProviderChange\?\.\('botid'\)/);
});

test('login validates password hash presence before bcrypt compare', () => {
  assert.match(auth, /if \(!paciente\.password_hash \|\| paciente\.password_hash\.trim\(\)\.length === 0\)/);
  assert.match(auth, /bcrypt\.compare\(data\.password,\s*paciente\.password_hash\)/);
});

test('auth actions support botid provider fallback and login sends captchaProvider', () => {
  assert.match(auth, /captchaProvider:\s*z\.enum\(\['turnstile',\s*'botid'\]\)\.optional\(\)/);
  assert.match(auth, /data\.captchaProvider !== 'botid'/);
  assert.match(auth, /botIdModuleName\s*=\s*'botid\/server'/);
  assert.match(auth, /isBotIdVerified/);
  assert.match(login, /name=\"captchaProvider\" value=\{captchaProvider\}/);
});

test('session signing supports auth secret fallback chain', () => {
  assert.match(session, /process\.env\.AUTH_SECRET/);
  assert.match(session, /process\.env\.SESSION_SECRET/);
  assert.match(session, /process\.env\.NEXTAUTH_SECRET/);
});

test('prisma config and prisma client support supabase/postgres env fallbacks', () => {
  assert.match(prismaConfig, /SUPABASE_DB_URL/);
  assert.match(prismaConfig, /POSTGRES_URL/);
  assert.match(prismaLib, /process\.env\.SUPABASE_DB_URL/);
  assert.match(prismaLib, /process\.env\.POSTGRES_URL/);
});

test('readme documents auth runtime resilience checks', () => {
  assert.match(readme, /Resiliencia de autenticación y runtime/);
  assert.match(readme, /Turnstile no está disponible/i);
});
