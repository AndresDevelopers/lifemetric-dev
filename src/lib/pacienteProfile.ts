import { prisma } from "@/lib/prisma";

export type PacienteProfileExtras = {
  fechaNacimiento?: string | null;
  avatarUrl?: string | null;
  alturaCm?: number | null;
  motivoRegistro?: string | null;
  productoPermitidoRegistro?: string | null;
  doctorAsignado?: string | null;
};

// Prisma $queryRaw returns NUMERIC columns as Decimal objects at runtime.
// We use this internal type to reflect what actually comes back, then coerce.
type PacienteProfileRaw = {
  fecha_nacimiento: Date | null;
  avatar_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  altura_cm: any; // Decimal | number | null at runtime
  motivo_registro: string | null;
  producto_permitido_registro: string | null;
  doctor_asignado: string | null;
};

type PacienteProfileRow = {
  fecha_nacimiento: Date | null;
  avatar_url: string | null;
  altura_cm: number | null;
  motivo_registro: string | null;
  producto_permitido_registro: string | null;
  doctor_asignado: string | null;
};

export async function ensurePacienteProfileColumns() {
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(5,2)");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS motivo_registro TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS producto_permitido_registro TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS doctor_asignado TEXT");
}

export async function getPacienteProfileExtras(pacienteId: string): Promise<PacienteProfileRow> {
  await ensurePacienteProfileColumns();
  const rows = await prisma.$queryRaw<PacienteProfileRaw[]>`
    SELECT fecha_nacimiento, avatar_url, altura_cm, motivo_registro, producto_permitido_registro, doctor_asignado
    FROM pacientes
    WHERE paciente_id = ${pacienteId}::uuid
    LIMIT 1
  `;

  const raw = rows[0];
  if (!raw) {
    return { fecha_nacimiento: null, avatar_url: null, altura_cm: null, motivo_registro: null, producto_permitido_registro: null, doctor_asignado: null };
  }

  // Coerce Decimal → plain number so the value is safely serializable across
  // the Server → Client boundary (Next.js Server Components constraint).
  const rawAltura = raw.altura_cm;
  const alturaCm: number | null =
    rawAltura == null
      ? null
      : typeof rawAltura.toNumber === 'function'
        ? (rawAltura.toNumber() as number)
        : Number(rawAltura);

  return { ...raw, altura_cm: alturaCm };
}

export async function updatePacienteProfileExtras(pacienteId: string, extras: PacienteProfileExtras) {
  await ensurePacienteProfileColumns();

  await prisma.$executeRaw`
    UPDATE pacientes
    SET
      fecha_nacimiento = ${extras.fechaNacimiento ?? null}::date,
      avatar_url = ${extras.avatarUrl ?? null},
      altura_cm = ${extras.alturaCm ?? null},
      motivo_registro = ${extras.motivoRegistro ?? null},
      producto_permitido_registro = ${extras.productoPermitidoRegistro ?? null},
      doctor_asignado = ${extras.doctorAsignado ?? null}
    WHERE paciente_id = ${pacienteId}::uuid
  `;
}
