"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isBannedPromoProduct } from "@/lib/productCatalog";

const medicacionInputSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha: z.string().min(1),
  hora: z.string().min(1),
  medicamento: z.string().min(2),
  dosis: z.string().optional(),
  estado_toma: z.enum(["tomada", "olvidada", "omitida_por_efecto", "retrasada"]),
  comentarios: z.string().optional(),
  foto_url: z.string().url().optional(),
  // Medication records stay manual; AI must not scan photos to populate fields.
});

export async function guardarRegistroMedicacion(input: z.infer<typeof medicacionInputSchema>) {
  const parsedInput = medicacionInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false as const, error: "validation_error" };
  }

  try {
    if (isBannedPromoProduct(parsedInput.data.medicamento)) {
      return { success: false as const, error: "restricted_product" };
    }

    const medicacion = await prisma.registroMedicacion.create({
      data: {
        paciente_id: parsedInput.data.paciente_id,
        fecha: new Date(parsedInput.data.fecha),
        hora: new Date(`1970-01-01T${parsedInput.data.hora}:00Z`),
        medicamento: parsedInput.data.medicamento,
        dosis: parsedInput.data.dosis?.trim() || "No especificada",
        estado_toma: parsedInput.data.estado_toma,
        comentarios: parsedInput.data.comentarios,
        foto_url: parsedInput.data.foto_url,
      },
    });

    return { success: true as const, medicacion };
  } catch {
    return { success: false as const, error: "save_error" };
  }
}
