const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'testuser2@lifemetric.mx';
  const password = 'Password123!';
  const password_hash = await bcrypt.hash(password, 10);
  
  let user = await prisma.paciente.findFirst({ where: { email } });
  if (!user) {
    user = await prisma.paciente.create({
      data: {
        nombre: 'Kevin',
        apellido: 'Test',
        edad: 30,
        sexo: 'M',
        diagnostico_principal: 'None',
        email,
        password_hash,
      }
    });
    console.log("Created user:", user.email);
  } else {
    // Update password just in case
    await prisma.paciente.update({
      where: { paciente_id: user.paciente_id },
      data: { password_hash }
    });
    console.log("Updated user password:", user.email);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
