"use server";

import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function getSessionPacienteId() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('lifemetric_session')?.value;
  if (!sessionToken) return null;
  const payload = await verifySession(sessionToken);
  if (!payload) return null;
  
  try {
    const parsedPayload = JSON.parse(payload);
    return parsedPayload.pacienteId;
  } catch {
    return null;
  }
}

export async function getSessionPaciente() {
  const pacienteId = await getSessionPacienteId();
  if (!pacienteId) return null;

  try {
    const paciente = await prisma.paciente.findUnique({
      where: { paciente_id: pacienteId },
      select: {
        nombre: true,
        apellido: true,
        email: true,
        sexo: true,
        newsletter_suscrito: true,
      },
    });
    return paciente
      ? {
          ...paciente,
          fecha_nacimiento: null,
          avatar_url: null,
        }
      : null;
  } catch (error) {
    console.error("Error fetching patient, returning fallback:", error);
    // Fallback para evitar bloqueo de UI si la DB no está sincronizada
    return {
      nombre: "Usuario",
      apellido: "",
      email: "",
      sexo: "M",
      newsletter_suscrito: true,
      fecha_nacimiento: null,
      avatar_url: null
    };
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
