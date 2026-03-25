
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    return;
  }
  const pool = new Pool({ connectionString: connectionString.replace(/\\\$/g, '$') });
  const adapter = new PrismaPg(pool as any);
  const prisma = new PrismaClient({ adapter });

  try {
     const tables = ['pacientes', 'comidas', 'glucosa', 'habitos', 'laboratorios', 'medicacion'];
     for (const table of tables) {
       console.log(`Checking table: ${table}`);
       const result = await prisma.$queryRawUnsafe(`
         SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = '${table}'
       `);
       console.log(JSON.stringify(result, null, 2));
     }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
