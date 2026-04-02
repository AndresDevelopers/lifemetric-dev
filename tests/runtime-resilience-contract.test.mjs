import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
const redisPath = path.join(process.cwd(), 'src', 'lib', 'redis.ts');
const turnstilePath = path.join(process.cwd(), 'src', 'components', 'auth', 'TurnstileWidget.tsx');
const authPath = path.join(process.cwd(), 'src', 'actions', 'auth.ts');
const dataPath = path.join(process.cwd(), 'src', 'actions', 'data.ts');
const loginPath = path.join(process.cwd(), 'src', 'app', 'login', 'page.tsx');
const registerPath = path.join(process.cwd(), 'src', 'app', 'registro', 'page.tsx');
const sessionPath = path.join(process.cwd(), 'src', 'lib', 'session.ts');
const prismaConfigPath = path.join(process.cwd(), 'prisma.config.ts');
const prismaLibPath = path.join(process.cwd(), 'src', 'lib', 'prisma.ts');
const supabaseLibPath = path.join(process.cwd(), 'src', 'lib', 'supabase.ts');
const emailPath = path.join(process.cwd(), 'src', 'lib', 'email.ts');
const retentionRoutePath = path.join(process.cwd(), 'src', 'app', 'api', 'maintenance', 'storage-retention', 'route.ts');
const labPagePath = path.join(process.cwd(), 'src', 'app', 'laboratorios', 'nuevo', 'page.tsx');
const storageRetentionLibPath = path.join(process.cwd(), 'src', 'lib', 'storageRetention.ts');
const readmePath = path.join(process.cwd(), 'README.md');
const packageJsonPath = path.join(process.cwd(), 'package.json');
const geminiPath = path.join(process.cwd(), 'src', 'lib', 'ai', 'gemini.ts');

const layout = fs.readFileSync(layoutPath, 'utf8');
const redis = fs.readFileSync(redisPath, 'utf8');
const turnstile = fs.readFileSync(turnstilePath, 'utf8');
const auth = fs.readFileSync(authPath, 'utf8');
const dataActions = fs.readFileSync(dataPath, 'utf8');
const login = fs.readFileSync(loginPath, 'utf8');
const register = fs.readFileSync(registerPath, 'utf8');
const session = fs.readFileSync(sessionPath, 'utf8');
const prismaConfig = fs.readFileSync(prismaConfigPath, 'utf8');
const prismaLib = fs.readFileSync(prismaLibPath, 'utf8');
const supabaseLib = fs.readFileSync(supabaseLibPath, 'utf8');
const email = fs.readFileSync(emailPath, 'utf8');
const retentionRoute = fs.readFileSync(retentionRoutePath, 'utf8');
const labPage = fs.readFileSync(labPagePath, 'utf8');
const storageRetentionLib = fs.readFileSync(storageRetentionLibPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
const gemini = fs.readFileSync(geminiPath, 'utf8');
const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');

test('layout avoids hard dependency on @vercel/analytics/react', () => {
  assert.doesNotMatch(layout, /@vercel\/analytics\/react/);
});


test('gemini PDF parser is lazy-loaded to avoid DOM globals at auth runtime', () => {
  assert.doesNotMatch(gemini, /import \{ PDFParse \} from "pdf-parse"/);
  assert.match(gemini, /await import\("pdf-parse"\)/);
  assert.match(gemini, /getPdfParseConstructor/);
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

test('login bootstraps paciente row when supabase auth user exists but profile row is missing', () => {
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /if \(!paciente\)/);
  assert.match(auth, /getDefaultPacienteData/);
  assert.match(auth, /password_hash:\s*await bcrypt\.hash\((data|input)\.password,\s*10\)/);
});

test('auth actions support botid provider fallback and login sends captchaProvider', () => {
  assert.match(auth, /captchaProvider:\s*z\.enum\(\['turnstile',\s*'botid'\]\)\.optional\(\)/);
  assert.match(auth, /clientTimeZone:\s*z\.string\(\)\.optional\(\)/);
  assert.match(auth, /data\.captchaProvider !== 'botid'/);
  assert.match(auth, /x-vercel-botid/);
  assert.match(auth, /isBotIdBlocked/);
  assert.match(auth, /persistRuntimeGeoCookies\(data\.clientTimeZone\)/);
  assert.match(login, /name=\"captchaProvider\" value=\{captchaProvider\}/);
  assert.match(login, /name=\"clientTimeZone\" value=\{clientTimeZone\}/);
  assert.match(login, /accountDeleted/);
});

test('auth actions use supabase auth for sign in, sign up and recovery', () => {
  assert.match(auth, /createSupabaseServerClient/);
  assert.match(auth, /signInWithPassword/);
  assert.match(auth, /signUp/);
  assert.match(auth, /resetPasswordForEmail/);
  assert.match(auth, /autoSignInData/);
  assert.match(auth, /useServiceRole:\s*false/);
  assert.match(auth, /fechaNacimiento/);
  assert.match(auth, /calculateAgeFromBirthDate/);
  assert.match(supabaseLib, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=/);
});

test('register page does not auto-redirect when registration requires email verification', () => {
  assert.doesNotMatch(register, /router\.push\('\//);
  assert.match(register, /name="fechaNacimiento"/);
  assert.match(register, /name="diagnostico"/);
  assert.match(register, /name="productoPermitido"/);
  assert.match(register, /name="clientTimeZone"/);
  assert.doesNotMatch(register, /name="doctorAsignado"/);
  assert.match(register, /diagnosisOptions\.map/);
});

test('auth success navigation happens in server actions instead of client router pushes', () => {
  assert.match(auth, /redirectTo = '\/'/);
  assert.match(auth, /if \(redirectTo\) \{\s*redirect\(redirectTo\);/);
  assert.doesNotMatch(login, /router\.push\('\//);
  assert.doesNotMatch(register, /router\.push\('\//);
});

test('session signing supports auth secret fallback chain', () => {
  assert.match(session, /process\.env\.AUTH_SECRET/);
  assert.match(session, /process\.env\.SESSION_SECRET/);
  assert.match(session, /process\.env\.NEXTAUTH_SECRET/);
});

test('prisma config and prisma client support supabase/postgres env fallbacks', () => {
  assert.match(prismaConfig, /SUPABASE_DB_URL/);
  assert.match(prismaConfig, /SUPABASE_POOLER_URL/);
  assert.match(prismaConfig, /POSTGRES_URL/);
  assert.match(prismaLib, /process\.env\.SUPABASE_DB_URL/);
  assert.match(prismaLib, /process\.env\.SUPABASE_POOLER_URL/);
  assert.match(prismaLib, /process\.env\.POSTGRES_URL/);
  assert.doesNotMatch(prismaLib, /127\.0\.0\.1:5432/);
  assert.match(prismaLib, /Missing database connection string/);
});

test('login action handles prisma runtime errors without exposing server error message', () => {
  assert.match(auth, /PrismaClientInitializationError/);
  assert.match(auth, /return \{ error: authMessages\.invalidCredentials \}/);
});

test('session resolver does not fake an authenticated fallback profile when db is unavailable', () => {
  assert.match(dataActions, /return null;/);
  assert.doesNotMatch(dataActions, /nombre:\s*"Usuario"/);
});

test('readme documents auth runtime resilience checks', () => {
  assert.match(readme, /Resiliencia de autenticación y runtime/);
  assert.match(readme, /Turnstile no está disponible/i);
});

test('email fallback keeps smtp dependency and avoids relying on sendmail in windows', () => {
  assert.match(packageJson, /"nodemailer": "8\.0\.4"/);
  assert.match(email, /hasSmtpConfiguration/);
  assert.match(email, /process\.platform === 'win32'/);
  assert.match(readme, /Fallback SMTP con Nodemailer/);
});

test('delete account keeps lab evidence while purging user data and uploaded meal images', () => {
  assert.match(auth, /registroMedicacion\.deleteMany/);
  assert.match(auth, /comida\.deleteMany/);
  assert.match(auth, /paciente\.update/);
  assert.match(auth, /Cuenta eliminada/);
  assert.match(auth, /storage\.from\('comidas'\)\.remove/);
  assert.match(auth, /confirmPassword/);
  assert.match(auth, /bcrypt\.compare/);
  assert.match(auth, /redirect\(`\/login\?accountDeleted=1&lang=\$\{locale\}`\)/);
});

test('laboratory uploads use dedicated storage bucket and retention route exists', () => {
  assert.match(labPage, /storage\.from\("laboratorios"\)\.upload/);
  assert.match(retentionRoute, /MEAL_IMAGE_RETENTION_DAYS/);
  assert.match(retentionRoute, /LAB_IMAGE_RETENTION_DAYS/);
  assert.match(retentionRoute, /deletedInactiveAccounts/);
  assert.match(retentionRoute, /last_login_at/);
  assert.match(storageRetentionLib, /365/);
  assert.match(storageRetentionLib, /730/);
});
