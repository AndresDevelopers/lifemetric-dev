import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

function getEnvValue(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function getEnvWithFallback(name: 'DATABASE_URL' | 'DIRECT_URL', fallback: string) {
  try {
    return env(name);
  } catch {
    if (!fallback) {
      throw new Error(`${name} is not set. Define ${name} or SUPABASE_DB_URL / POSTGRES_URL.`);
    }
    return fallback;
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: getEnvWithFallback(
      'DATABASE_URL',
      getEnvValue('SUPABASE_DB_URL') ??
        getEnvValue('SUPABASE_DATABASE_URL') ??
        getEnvValue('POSTGRES_URL') ??
        getEnvValue('POSTGRES_PRISMA_URL') ??
        ''
    ),
    shadowDatabaseUrl: getEnvWithFallback(
      'DIRECT_URL',
      getEnvValue('SUPABASE_DB_URL') ??
        getEnvValue('SUPABASE_DATABASE_URL') ??
        getEnvValue('POSTGRES_URL') ??
        getEnvValue('POSTGRES_PRISMA_URL') ??
        ''
    ),
  },
});
