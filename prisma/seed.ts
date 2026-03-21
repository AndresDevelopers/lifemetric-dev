import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const paciente = await prisma.paciente.create({
    data: {
      nombre: 'Juan',
      apellido: 'Prueba',
      edad: 52,
      sexo: 'Masculino',
      diagnostico_principal: 'Diabetes tipo 2',
      usa_glucometro: true,
      medicacion_base: 'Metformina 850 mg c/12 h',
      peso_inicial_kg: 84,
      cintura_inicial_cm: 102,
      objetivo_clinico: 'Bajar glucosa',
      activo: true,
      // The DB will default to today for fecha_alta
    },
  })
  console.log('Paciente de prueba creado con ID:', paciente.paciente_id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
