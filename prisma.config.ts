import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

const fallbackDbUrl = 'postgresql://postgres:postgres@localhost:5432/lifemetric';

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
    url: getEnvWithFallback('DATABASE_URL', fallbackDbUrl),
    shadowDatabaseUrl: getEnvWithFallback('DIRECT_URL', fallbackDbUrl),
  },
});
