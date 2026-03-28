"use server";

import { prisma } from "@/lib/prisma";
import { estimateMedicationFromImage } from "@/lib/ai/gemini";
import { z } from "zod";
import { checkRateLimit } from "@/lib/redis";
import { getSessionPacienteId } from "@/actions/data";

const medicacionInputSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha: z.string().min(1),
  hora: z.string().min(1),
  medicamento: z.string().min(2),
  dosis: z.string().min(1),
  estado_toma: z.enum(["tomada", "olvidada", "omitida_por_efecto", "retrasada"]),
  comentarios: z.string().optional(),
});

const medicationPhotoSchema = z.object({
  imageUrl: z.string().url(),
  locale: z.enum(["es", "en"]),
});

export async function inferMedicationFromPhoto(input: z.infer<typeof medicationPhotoSchema>) {
  const parsedInput = medicationPhotoSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false as const, error: "invalid_input" };
  }

  try {
    const pacienteId = await getSessionPacienteId();
    if (!pacienteId) {
       return { success: false as const, error: "not_authorized" };
    }
    
    const isAllowed = await checkRateLimit(`medication_ai:${pacienteId}`);
    if (!isAllowed) {
       return { success: false as const, error: "ai_rate_limited" };
    }

    const aiResult = await estimateMedicationFromImage(parsedInput.data);
    if (!aiResult) {
      return { success: false as const, error: "ai_unavailable" };
    }

    return { success: true as const, data: aiResult };
  } catch {
    return { success: false as const, error: "ai_failed" };
  }
}

export async function guardarRegistroMedicacion(input: z.infer<typeof medicacionInputSchema>) {
  const parsedInput = medicacionInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false as const, error: "validation_error" };
  }

  try {
    const medicacion = await prisma.registroMedicacion.create({
      data: {
        paciente_id: parsedInput.data.paciente_id,
        fecha: new Date(parsedInput.data.fecha),
        hora: new Date(`1970-01-01T${parsedInput.data.hora}:00Z`),
        medicamento: parsedInput.data.medicamento,
        dosis: parsedInput.data.dosis,
        estado_toma: parsedInput.data.estado_toma,
        comentarios: parsedInput.data.comentarios,
      },
    });

    return { success: true as const, medicacion };
  } catch {
    return { success: false as const, error: "save_error" };
  }
}
