import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

function getEnvValue(name: string) {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

function getDatabaseFallback() {
  return (
    getEnvValue('PRISMA_DATABASE_URL') ??
    getEnvValue('SUPABASE_DB_URL') ??
    getEnvValue('SUPABASE_DATABASE_URL') ??
    getEnvValue('SUPABASE_POOLER_URL') ??
    getEnvValue('POSTGRES_URL') ??
    getEnvValue('POSTGRES_PRISMA_URL') ??
    getEnvValue('POSTGRES_URL_NON_POOLING') ??
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
  );
}

function getEnvWithFallback(name: 'DATABASE_URL' | 'DIRECT_URL', fallback: string) {
  try {
    return env(name);
  } catch {
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
      getDatabaseFallback()
    ),
    shadowDatabaseUrl: getEnvWithFallback(
      'DIRECT_URL',
      getDatabaseFallback()
    ),
  },
});
