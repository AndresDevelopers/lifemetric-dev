import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

config();

async function test() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Testing with URL (masked):', connectionString?.substring(0, 20) + '...');
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.paciente.count();
    console.log('Successfully connected! Patient count:', count);
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await pool.end();
  }
}

test();
