import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

config();

async function test() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Testing with URL (masked):', connectionString?.substring(0, 20) + '...');
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.paciente.count();
    console.log('Successfully connected! Patient count:', count);
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
