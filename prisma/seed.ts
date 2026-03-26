import { createPrismaClient } from '../src/lib/prisma'

const prisma = createPrismaClient()

async function main() {
  const paciente = await prisma.paciente.create({
    data: {
      nombre: 'Juan',
      apellido: 'Prueba',
      email: 'juan.prueba@ejemplo.com',
      password_hash: '$2a$10$Xm8B3z2pS8sP0pX.pT5p5uYV8uX8uX8uX8uX8uX8uX8uX8uX8uX8u', // Mock hash
      edad: 52,
      sexo: 'Masculino',
      diagnostico_principal: 'Diabetes tipo 2',
      usa_glucometro: true,
      medicacion_base: 'Metformina 850 mg c/12 h',
      metas_salud: 'Bajar glucosa y mejorar habitos de movimiento',
      peso_inicial: 84,
      estura: 1.72,
      nivel_actividad: 'moderado',
    },
  });
  console.log('Paciente de prueba creado con ID:', paciente.paciente_id);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
