import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  getStoragePathFromPublicUrl,
  LAB_IMAGE_RETENTION_DAYS,
  MEAL_IMAGE_RETENTION_DAYS,
  REGISTERED_MEDICATION_RETENTION_DAYS,
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
  const medicationCutoff = new Date(now - REGISTERED_MEDICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const inactiveUserCutoff = new Date(now - 365 * 24 * 60 * 60 * 1000);
  const labGracePeriodCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000); // 30 days for deleted accounts

  // Ensure last_login_at exists (safety check)
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");
  await prisma.$executeRawUnsafe("ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ");

  const [oldMeals, oldLabs, oldMedications, labsFromDeletedAccounts] = await Promise.all([
    prisma.comida.findMany({
      where: { created_at: { lt: mealCutoff } },
      select: { comida_id: true, foto_url: true },
    }),
    prisma.laboratorio.findMany({
      where: {
        created_at: { lt: labCutoff },
        archivo_url: { not: null },
      },
      select: { laboratorio_id: true, archivo_url: true },
    }),
    prisma.registroMedicacion.findMany({
      where: { created_at: { lt: medicationCutoff } },
      select: { registro_medicacion_id: true },
    }),
    // Labs from deleted accounts after 1 month grace period
    prisma.laboratorio.findMany({
      where: {
        paciente: {
          activo: false,
          deleted_at: { lt: labGracePeriodCutoff },
        },
        archivo_url: { not: null },
      },
      select: { laboratorio_id: true, archivo_url: true },
    }),
  ]);

  const deletedMealFiles: string[] = [];
  for (const meal of oldMeals) {
    if (meal.foto_url) {
      const path = getStoragePathFromPublicUrl(meal.foto_url, "comidas");
      if (path && !deletedMealFiles.includes(path)) {
        await supabase.storage.from("comidas").remove([path]);
        deletedMealFiles.push(path);
      }
    }
  }

  // Combine regular lab cleanup and grace period cleanup
  const allLabsToClean = [...oldLabs, ...labsFromDeletedAccounts];
  const labPathsToRemove: string[] = [];
  const labIdsToUpdate: string[] = [];
  for (const lab of allLabsToClean) {
    if (lab.archivo_url) {
      const path = getStoragePathFromPublicUrl(lab.archivo_url, "laboratorios");
      if (path && !labPathsToRemove.includes(path)) {
        labPathsToRemove.push(path);
        labIdsToUpdate.push(lab.laboratorio_id);
      }
    }
  }

  if (labPathsToRemove.length > 0) {
    await supabase.storage.from("laboratorios").remove(labPathsToRemove);
    await prisma.laboratorio.updateMany({
      where: { laboratorio_id: { in: labIdsToUpdate } },
      data: { archivo_url: null },
    });
  }

  // Deleting records for meals and medications
  if (oldMeals.length > 0) {
    const mealIds = oldMeals.map((m: { comida_id: string }) => m.comida_id);
    await prisma.glucosa.updateMany({
      where: { comida_relacionada_id: { in: mealIds } },
      data: { comida_relacionada_id: null },
    });
    await prisma.comida.deleteMany({
      where: { comida_id: { in: mealIds } },
    });
  }

  if (oldMedications.length > 0) {
    const medIds = oldMedications.map((m: { registro_medicacion_id: string }) => m.registro_medicacion_id);
    await prisma.registroMedicacion.deleteMany({
      where: { registro_medicacion_id: { in: medIds } },
    });
  }

  // Inactive user deactivation logic
  const inactivePatients = await prisma.$queryRaw<Array<{ paciente_id: string; email: string }>>`
    SELECT paciente_id::text, email
    FROM pacientes
    WHERE COALESCE(last_login_at, created_at) < ${inactiveUserCutoff}
      AND activo = true
      AND email NOT LIKE 'deleted-%@lifemetric.invalid'
  `;

  let deactivatedInactiveAccounts = 0;
  if (inactivePatients.length > 0) {
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
            deleted_at: new Date(),
          },
        }),
      ]);

      if (patientMealPaths.length > 0) {
        await supabase.storage.from("comidas").remove(patientMealPaths);
      }

      const authUser = usersPage?.users.find((item) => item.email?.toLowerCase() === paciente.email.toLowerCase());
      if (authUser?.id) {
        await supabase.auth.admin.deleteUser(authUser.id);
      }
      deactivatedInactiveAccounts += 1;
    }
  }

  return NextResponse.json({
    success: true,
    processed: {
      mealsDeleted: oldMeals.length,
      mealImagesDeleted: deletedMealFiles.length,
      labImagesDeleted: labPathsToRemove.length,
      medicationsDeleted: oldMedications.length,
      inactiveAccountsDeactivated: deactivatedInactiveAccounts,
    },
  });
}
