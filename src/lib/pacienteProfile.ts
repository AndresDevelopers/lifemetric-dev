import { prisma } from "@/lib/prisma";

export type PacienteProfileExtras = {
  fechaNacimiento?: string | null;
  avatarUrl?: string | null;
  alturaCm?: number | null;
  motivoRegistro?: string | null;
};

type PacienteProfileRow = {
  fecha_nacimiento: Date | null;
  avatar_url: string | null;
  altura_cm: number | null;
  motivo_registro: string | null;
};

export async function ensurePacienteProfileColumns() {
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS altura_cm NUMERIC(5,2)");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS motivo_registro TEXT");
}

export async function getPacienteProfileExtras(pacienteId: string): Promise<PacienteProfileRow> {
  await ensurePacienteProfileColumns();
  const rows = await prisma.$queryRaw<PacienteProfileRow[]>`
    SELECT fecha_nacimiento, avatar_url, altura_cm, motivo_registro
    FROM pacientes
    WHERE paciente_id = ${pacienteId}::uuid
    LIMIT 1
  `;

  return rows[0] ?? {
    fecha_nacimiento: null,
    avatar_url: null,
    altura_cm: null,
    motivo_registro: null,
  };
}

export async function updatePacienteProfileExtras(pacienteId: string, extras: PacienteProfileExtras) {
  await ensurePacienteProfileColumns();

  await prisma.$executeRaw`
    UPDATE pacientes
    SET
      fecha_nacimiento = ${extras.fechaNacimiento ?? null}::date,
      avatar_url = ${extras.avatarUrl ?? null},
      altura_cm = ${extras.alturaCm ?? null},
      motivo_registro = ${extras.motivoRegistro ?? null}
    WHERE paciente_id = ${pacienteId}::uuid
  `;
}
