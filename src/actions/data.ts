"use server";

import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { intelligentCache } from "@/lib/redis";
import { getPacienteProfileExtras } from "@/lib/pacienteProfile";

export async function getSessionPacienteId() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('lifemetric_session')?.value;
  if (!sessionToken) return null;
  const payload = await verifySession(sessionToken);
  if (!payload) return null;
  
  try {
    const parsedPayload = JSON.parse(payload) as { pacienteId?: string; timestamp?: number };
    if (!parsedPayload.pacienteId || typeof parsedPayload.timestamp !== 'number') return null;

    const sessionRows = await prisma.$queryRaw<Array<{ last_login_at: Date | null; activo: boolean }>>`
      SELECT last_login_at, activo
      FROM pacientes
      WHERE paciente_id = ${parsedPayload.pacienteId}::uuid
      LIMIT 1
    `;

    const lastLoginAt = sessionRows[0]?.last_login_at ?? null;
    const isActive = sessionRows[0]?.activo ?? false;
    if (!isActive) {
      return null;
    }
    const lastLoginMs = lastLoginAt ? new Date(lastLoginAt).getTime() : null;
    // Invalidate sessions that were issued more than 30 seconds BEFORE the last recorded login.
    // This protects against session fixation while tolerating the race condition between
    // setSession() (cookie) and touchPacienteLastLogin() (DB update) during the login flow.
    // A 30-second tolerance comfortably covers any DB/network latency.
    // NOTE: This check is bypassed in development to allow multiple concurrent sessions.
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && lastLoginMs && parsedPayload.timestamp + 30_000 < lastLoginMs) {
      return null;
    }

    return parsedPayload.pacienteId;
  } catch {
    return null;
  }
}

export async function getSessionPaciente() {
  const pacienteId = await getSessionPacienteId();
  if (!pacienteId) return null;

  try {
    const paciente = await intelligentCache(
      `paciente-${pacienteId}`,
      async () => {
        return await prisma.paciente.findUnique({
          where: { paciente_id: pacienteId },
          select: {
            paciente_id: true,
            nombre: true,
            apellido: true,
            email: true,
            sexo: true,
            newsletter_suscrito: true,
            idioma: true,
          },
        });
      },
      { revalidate: 300, tags: [`paciente-${pacienteId}`] }
    );
    if (!paciente) return null;

    const profileExtras = await getPacienteProfileExtras(pacienteId);
    // Convert Prisma Decimal fields to plain numbers so they can be passed
    // to Client Components across the Server → Client boundary.
    const alturaCmRaw = profileExtras.altura_cm;
    let alturaCm: number | null = null;
    if (alturaCmRaw != null) {
      const withToNumber = alturaCmRaw as unknown as { toNumber?: () => number };
      alturaCm = typeof withToNumber.toNumber === 'function'
        ? withToNumber.toNumber()
        : Number(alturaCmRaw);
    }
    return {
      ...paciente,
      fecha_nacimiento: profileExtras.fecha_nacimiento,
      avatar_url: profileExtras.avatar_url,
      altura_cm: alturaCm,
      motivo_registro: profileExtras.motivo_registro,
      producto_permitido_registro: profileExtras.producto_permitido_registro,
    };
  } catch (error) {
    console.error("Error fetching patient session:", error);
    return null;
  }
}

export async function getComidasDeHoy() {
  const pacienteId = await getSessionPacienteId();
  if (!pacienteId) return [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const comidas = await prisma.comida.findMany({
    where: {
      paciente_id: pacienteId,
      fecha: {
        gte: hoy
      }
    },
    orderBy: {
      fecha: 'desc'
    }
  });

  return comidas;
}
