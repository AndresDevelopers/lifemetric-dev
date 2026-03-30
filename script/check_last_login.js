require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT last_login_at FROM pacientes LIMIT 1`;
    console.log("Success! result:", result);
  } catch (error) {
    console.error("FAIL! Error running query:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
