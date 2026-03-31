import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.SUPABASE_DB_URL,
    process.env.SUPABASE_DATABASE_URL,
    process.env.SUPABASE_POOLER_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  const connectionString = candidates.find((value) => value && value.trim().length > 0);

  if (connectionString) {
    return connectionString;
  }

  throw new Error(
    'Missing database connection string. Set DATABASE_URL, DIRECT_URL, SUPABASE_DB_URL, SUPABASE_DATABASE_URL, SUPABASE_POOLER_URL or POSTGRES_* env variables.'
  );
}

export function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: getConnectionString(),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
