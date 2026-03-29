import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  getStoragePathFromPublicUrl,
  LAB_IMAGE_RETENTION_DAYS,
  MEAL_IMAGE_RETENTION_DAYS,
} from "@/lib/storageRetention";

function isAuthorized(request: Request): boolean {
  const token = process.env.MAINTENANCE_JOB_TOKEN;
  if (!token) return false;
  const incoming = request.headers.get("authorization")?.replace("Bearer ", "");
  return incoming === token;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServerClient({ useServiceRole: true });
  const now = Date.now();
  const mealCutoff = new Date(now - MEAL_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const labCutoff = new Date(now - LAB_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const inactiveUserCutoff = new Date(now - MEAL_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");

  const [oldMeals, oldLabs] = await Promise.all([
    prisma.comida.findMany({
      where: { created_at: { lt: mealCutoff }, foto_url: { not: null } },
      select: { comida_id: true, foto_url: true },
    }),
    prisma.laboratorio.findMany({
      where: { created_at: { lt: labCutoff }, archivo_url: { not: null } },
      select: { laboratorio_id: true, archivo_url: true },
    }),
  ]);

  const mealPaths = oldMeals
    .map((item: { foto_url: string | null }) => getStoragePathFromPublicUrl(item.foto_url ?? "", "comidas"))
    .filter((value: string | null): value is string => Boolean(value));
  const labPaths = oldLabs
    .map((item: { archivo_url: string | null }) => getStoragePathFromPublicUrl(item.archivo_url ?? "", "laboratorios"))
    .filter((value: string | null): value is string => Boolean(value));

  if (mealPaths.length) {
    await supabase.storage.from("comidas").remove(mealPaths);
  }
  if (labPaths.length) {
    await supabase.storage.from("laboratorios").remove(labPaths);
  }

  if (oldMeals.length) {
    await prisma.comida.updateMany({
      where: { comida_id: { in: oldMeals.map((item: { comida_id: string }) => item.comida_id) } },
      data: { foto_url: null },
    });
  }
  if (oldLabs.length) {
    await prisma.laboratorio.updateMany({
      where: { laboratorio_id: { in: oldLabs.map((item: { laboratorio_id: string }) => item.laboratorio_id) } },
      data: { archivo_url: null },
    });
  }

  const inactivePatients = await prisma.$queryRaw<Array<{ paciente_id: string; email: string }>>`
    SELECT paciente_id::text, email
    FROM pacientes
    WHERE COALESCE(last_login_at, created_at) < ${inactiveUserCutoff}
      AND activo = true
      AND email NOT LIKE 'deleted-%@lifemetric.invalid'
  `;

  let deletedInactiveAccounts = 0;
  if (inactivePatients.length) {
    const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    for (const paciente of inactivePatients) {
      const patientMealPhotos = await prisma.comida.findMany({
        where: { paciente_id: paciente.paciente_id, foto_url: { not: null } },
        select: { foto_url: true },
      });
      const patientMealPaths = patientMealPhotos
        .map((item: { foto_url: string | null }) => getStoragePathFromPublicUrl(item.foto_url ?? "", "comidas"))
        .filter((value: string | null): value is string => Boolean(value));

      const replacementHash = await bcrypt.hash(crypto.randomUUID(), 10);
      await prisma.$transaction([
        prisma.glucosa.deleteMany({ where: { paciente_id: paciente.paciente_id } }),
        prisma.habito.deleteMany({ where: { paciente_id: paciente.paciente_id } }),
        prisma.comida.deleteMany({ where: { paciente_id: paciente.paciente_id } }),
        prisma.registroMedicacion.deleteMany({ where: { paciente_id: paciente.paciente_id } }),
        prisma.paciente.update({
          where: { paciente_id: paciente.paciente_id },
          data: {
            nombre: "Cuenta",
            apellido: "Eliminada",
            email: `deleted-${paciente.paciente_id}@lifemetric.invalid`,
            password_hash: replacementHash,
            newsletter_suscrito: false,
            diagnostico_principal: "Cuenta eliminada por inactividad",
            activo: false,
            medicacion_base: null,
            objetivo_clinico: null,
            cintura_inicial_cm: null,
            peso_inicial_kg: null,
          },
        }),
      ]);

      if (patientMealPaths.length) {
        await supabase.storage.from("comidas").remove(patientMealPaths);
      }

      const authUser = usersPage.users.find((item) => item.email?.toLowerCase() === paciente.email.toLowerCase());
      if (authUser?.id) {
        await supabase.auth.admin.deleteUser(authUser.id);
      }
      deletedInactiveAccounts += 1;
    }
  }

  return NextResponse.json({
    success: true,
    deletedMealImages: mealPaths.length,
    deletedLabImages: labPaths.length,
    deletedInactiveAccounts,
  });
}
