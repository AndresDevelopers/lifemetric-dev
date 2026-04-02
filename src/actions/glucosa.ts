"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { invalidateOnDataChange } from "@/lib/cache-invalidation";
import { z } from "zod";

const glucosaSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha: z.string(),
  hora: z.string(),
  tipo_glucosa: z.enum(["ayuno", "antes_comer", "antes_cena", "1h_post"]),
  valor_glucosa: z.number().min(20).max(600),
  comida_relacionada_id: z.string().uuid().optional().nullable(),
});

type GlucosaInput = z.infer<typeof glucosaSchema>;

function getClasificacionGlucosa(valor: number, tipo: string): string {
  if (valor < 70) return "Bajo (Hipoglucemia)";

  if (tipo === "ayuno") {
    if (valor <= 99) return "Normal";
    if (valor <= 125) return "Prediabetes (Ayuno alterado)";
    return "Diabetes (Elevada)";
  }
  
  if (tipo === "1h_post") {
    if (valor < 140) return "Normal";
    if (valor < 180) return "Aceptable";
    return "Elevada";
  }

  return valor <= 140 ? "Normal" : "Elevada";
}

export async function createGlucosaAction(data: GlucosaInput) {
  const result = glucosaSchema.safeParse(data);
  
  if (!result.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const { paciente_id, fecha, hora, tipo_glucosa, valor_glucosa, comida_relacionada_id } = result.data;

  try {
    const clasificacion = getClasificacionGlucosa(valor_glucosa, tipo_glucosa);
    
    // Simple delta logic: if it's postprandial and linked to a meal, 
    // try to find the "antes_comer" reading for the same day (not fully implemented here but placeholder)
    const delta = null;
    
    const nuevaGlucosa = await prisma.glucosa.create({
      data: {
        paciente_id,
        fecha: new Date(fecha),
        hora: new Date(`1970-01-01T${hora}:00Z`),
        tipo_glucosa,
        valor_glucosa,
        comida_relacionada_id: comida_relacionada_id || null,
        clasificacion_glucosa: clasificacion,
        delta_glucosa: delta,
      }
    });

    revalidatePath("/");
    revalidatePath("/resumen");
    
    // Invalidar caché de sugerencias de IA
    await invalidateOnDataChange(paciente_id, 'glucosa');
    
    return { success: true, data: nuevaGlucosa };
  } catch (error) {
    console.error("Error creating glucose record:", error);
    return { success: false, error: "Error al guardar el registro de glucosa" };
  }
}
