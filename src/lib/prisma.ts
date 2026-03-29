import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.SUPABASE_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL (or SUPABASE_DB_URL / POSTGRES_URL) is required to initialize Prisma.');
  }

  return connectionString;
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
