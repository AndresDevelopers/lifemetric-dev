import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getStoragePathFromPublicUrl } from "@/lib/storageRetention";
import { sendAccountDeactivatedEmail } from "@/lib/email";
import { defaultLocale, normalizeLocale, type Locale } from "@/lib/i18n";

export const ACCOUNT_INACTIVITY_DEACTIVATION_DAYS = 365;
export const ACCOUNT_INACTIVITY_DELETION_GRACE_DAYS = 90;

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$extends" | "$on" | "$transaction" | "$use"
>;

type LifecyclePacienteRow = {
  paciente_id: string;
  email: string;
  idioma: string | null;
  activo: boolean;
  created_at: Date;
  last_login_at: Date | null;
  deactivated_at: Date | null;
  inactivity_notification_sent_at: Date | null;
};

type AccountStoragePaths = {
  mealPaths: string[];
  medicationPaths: string[];
  labPaths: string[];
  avatarPaths: string[];
};

function dedupe(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function isDeletedPlaceholderEmail(email: string): boolean {
  return /^deleted-.*@lifemetric\.invalid$/i.test(email);
}

export function getInactivityReferenceDate(row: Pick<LifecyclePacienteRow, "last_login_at" | "created_at">): Date {
  return row.last_login_at ?? row.created_at;
}

export async function ensurePacienteLifecycleColumns() {
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");
    await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ");
    await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS inactivity_notification_sent_at TIMESTAMPTZ");
    await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS idx_pacientes_last_login_at ON pacientes (last_login_at)");
    await prisma.$executeRawUnsafe("CREATE INDEX IF NOT EXISTS idx_pacientes_deactivated_at ON pacientes (deactivated_at)");
  } catch (error) {
    console.warn("Failed to ensure paciente lifecycle columns:", error);
  }
}

export async function findLifecyclePacienteById(pacienteId: string): Promise<LifecyclePacienteRow | null> {
  await ensurePacienteLifecycleColumns();
  const rows = await prisma.$queryRaw<LifecyclePacienteRow[]>`
    SELECT
      paciente_id::text,
      email,
      idioma,
      activo,
      created_at,
      last_login_at,
      deactivated_at,
      inactivity_notification_sent_at
    FROM pacientes
    WHERE paciente_id = ${pacienteId}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function findLifecyclePacienteByEmail(email: string): Promise<LifecyclePacienteRow | null> {
  await ensurePacienteLifecycleColumns();
  const rows = await prisma.$queryRaw<LifecyclePacienteRow[]>`
    SELECT
      paciente_id::text,
      email,
      idioma,
      activo,
      created_at,
      last_login_at,
      deactivated_at,
      inactivity_notification_sent_at
    FROM pacientes
    WHERE LOWER(email) = LOWER(${email})
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getPacienteStoragePaths(pacienteId: string): Promise<AccountStoragePaths> {
  const [mealPhotos, medicationPhotos, labFiles, avatarRows] = await Promise.all([
    prisma.comida.findMany({
      where: { paciente_id: pacienteId, foto_url: { not: null } },
      select: { foto_url: true },
    }),
    prisma.registroMedicacion.findMany({
      where: { paciente_id: pacienteId, foto_url: { not: null } },
      select: { foto_url: true },
    }),
    prisma.laboratorio.findMany({
      where: { paciente_id: pacienteId, archivo_url: { not: null } },
      select: { archivo_url: true },
    }),
    prisma.$queryRaw<Array<{ avatar_url: string | null }>>`
      SELECT avatar_url
      FROM pacientes
      WHERE paciente_id = ${pacienteId}::uuid
      LIMIT 1
    `,
  ]);

  return {
    mealPaths: dedupe(
      mealPhotos.map((item: { foto_url: string | null }) => getStoragePathFromPublicUrl(item.foto_url ?? "", "comidas")),
    ),
    medicationPaths: dedupe(
      medicationPhotos.map((item: { foto_url: string | null }) => getStoragePathFromPublicUrl(item.foto_url ?? "", "medicina")),
    ),
    labPaths: dedupe(
      labFiles.map((item: { archivo_url: string | null }) => getStoragePathFromPublicUrl(item.archivo_url ?? "", "laboratorios")),
    ),
    avatarPaths: dedupe(
      avatarRows.map((item: { avatar_url: string | null }) => getStoragePathFromPublicUrl(item.avatar_url ?? "", "avatars")),
    ),
  };
}

async function deleteStoragePaths(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const supabase = createSupabaseServerClient({ useServiceRole: true });
  await supabase.storage.from(bucket).remove(paths);
}

async function deleteAuthUserByEmail(email: string) {
  if (isDeletedPlaceholderEmail(email)) return;
  const supabase = createSupabaseServerClient({ useServiceRole: true });
  const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = usersPage.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (authUser?.id) {
    await supabase.auth.admin.deleteUser(authUser.id);
  }
}

export async function permanentlyDeletePacienteAccount(pacienteId: string, replacementLabel: string) {
  await ensurePacienteLifecycleColumns();
  const paciente = await findLifecyclePacienteById(pacienteId);
  if (!paciente) {
    return { deleted: false };
  }

  const { mealPaths, medicationPaths, labPaths, avatarPaths } = await getPacienteStoragePaths(pacienteId);

  await prisma.$transaction(async (tx: TransactionClient) => {
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS feedback_entries (
        feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id UUID REFERENCES pacientes(paciente_id) ON DELETE SET NULL,
        paciente_email TEXT,
        tipo TEXT NOT NULL CHECK (tipo IN ('error', 'suggestion')),
        asunto TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await tx.$executeRaw`
      DELETE FROM feedback_entries
      WHERE paciente_id = ${pacienteId}::uuid
    `;
    await tx.glucosa.deleteMany({ where: { paciente_id: pacienteId } });
    await tx.habito.deleteMany({ where: { paciente_id: pacienteId } });
    await tx.registroMedicacion.deleteMany({ where: { paciente_id: pacienteId } });
    await tx.comida.deleteMany({ where: { paciente_id: pacienteId } });
    await tx.laboratorio.deleteMany({ where: { paciente_id: pacienteId } });
    await tx.paciente.delete({ where: { paciente_id: pacienteId } });
  });

  await Promise.all([
    deleteStoragePaths("comidas", mealPaths),
    deleteStoragePaths("medicina", medicationPaths),
    deleteStoragePaths("laboratorios", labPaths),
    deleteStoragePaths("avatars", avatarPaths),
    deleteAuthUserByEmail(paciente.email),
  ]);

  return {
    deleted: true,
    deletedMealImages: mealPaths.length,
    deletedMedicationImages: medicationPaths.length,
    deletedLabFiles: labPaths.length,
    deletedAvatarFiles: avatarPaths.length,
    deletedEmail: paciente.email,
    reason: replacementLabel,
  };
}

export async function markPacienteAsInactive(row: LifecyclePacienteRow) {
  await ensurePacienteLifecycleColumns();

  await prisma.$executeRaw`
    UPDATE pacientes
    SET
      activo = false,
      deactivated_at = COALESCE(deactivated_at, NOW()),
      inactivity_notification_sent_at = COALESCE(inactivity_notification_sent_at, NOW())
    WHERE paciente_id = ${row.paciente_id}::uuid
  `;

  const locale = normalizeLocale(row.idioma) as Locale;
  const deactivatedAt = new Date();
  const scheduledDeletionAt = new Date(
    deactivatedAt.getTime() + ACCOUNT_INACTIVITY_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  await sendAccountDeactivatedEmail({
    to: row.email,
    locale: locale || defaultLocale,
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Lifemetric",
    deactivatedAtIso: deactivatedAt.toISOString(),
    scheduledDeletionAtIso: scheduledDeletionAt.toISOString(),
  });
}

export async function reactivatePacienteAccount(pacienteId: string) {
  await ensurePacienteLifecycleColumns();
  await prisma.$executeRaw`
    UPDATE pacientes
    SET
      activo = true,
      deactivated_at = NULL,
      inactivity_notification_sent_at = NULL,
      last_login_at = NOW()
    WHERE paciente_id = ${pacienteId}::uuid
  `;
}

export async function anonymizePacienteCredentials(pacienteId: string) {
  const replacementHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await prisma.$executeRaw`
    UPDATE pacientes
    SET
      email = ${`deleted-${pacienteId}@lifemetric.invalid`},
      password_hash = ${replacementHash},
      newsletter_suscrito = false
    WHERE paciente_id = ${pacienteId}::uuid
  `;
}
