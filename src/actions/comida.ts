"use server";

import { prisma } from "@/lib/prisma";
import { estimateMealFromImage, type PacienteContexto } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/redis";
import { z } from "zod";

interface ComidaInput {
  paciente_id: string;
  fecha: string;
  hora: string;
  tipo_comida: string;
  foto_url?: string;
  nota?: string;
  alimento_principal?: string;
  kcal_estimadas?: number;
  proteina_g?: number;
  carbohidratos_g?: number;
  grasa_g?: number;
  fibra_g?: number;
  es_comida_valida?: boolean;
  es_saludable?: boolean;
  razon_inadecuada?: string;
  alternativa_saludable?: string;
}

const mealPhotoSchema = z.object({
  paciente_id: z.string().uuid(),
  foto_url: z.string().url(),
  locale: z.enum(["es", "en"]),
});

function getClasificacionProteina(proteina?: number): string {
  if (proteina === undefined) return "desconocida";
  return proteina < 20 ? "baja" : "adecuada";
}

function getClasificacionCarbohidrato(carbs?: number): string {
  if (carbs === undefined) return "desconocido";
  if (carbs > 45) return "alto";
  if (carbs >= 25) return "moderado";
  return "bajo";
}

function getClasificacionFibra(fibra?: number): string {
  if (fibra === undefined) return "desconocida";
  return fibra < 5 ? "baja" : "adecuada";
}

function getClasificacionFinal(
  carbs: string, 
  fibra: string, 
  proteina: string,
  esComidaValida: boolean = true,
  esSaludable: boolean = true,
  razonInadecuada?: string
): string {
  // Si la imagen no es una comida válida
  if (!esComidaValida) return "Inválido (No es comida)";
  
  // Si la comida no es saludable según la IA
  if (!esSaludable) return "Inadecuada: " + (razonInadecuada || "No recomendada");
  
  // Clasificación original basada en nutrientes
  if (carbs === "alto" && fibra === "baja") return "Inadecuada (Pico de Glucosa)";
  if (carbs === "bajo" && proteina === "adecuada") return "Saludable (Bajo índice)";
  return "Regular";
}

async function getPacienteContexto(pacienteId: string): Promise<PacienteContexto> {
  try {
    const [pacienteRows, labRows, comidasRows] = await Promise.all([
      prisma.$queryRaw<Array<{
        diagnostico_principal: string | null;
        objetivo_clinico: string | null;
        sexo: string | null;
        edad: number | null;
        motivo_registro: string | null;
      }>>`
        SELECT diagnostico_principal, objetivo_clinico, sexo, edad, motivo_registro
        FROM pacientes
        WHERE paciente_id = ${pacienteId}::uuid
        LIMIT 1
      `.catch((e: unknown) => {
        console.warn("Failed to fetch paciente raw profile:", e);
        return [];
      }),
      prisma.laboratorio.findFirst({
        where: { paciente_id: pacienteId },
        orderBy: { fecha_estudio: "desc" },
        select: { hba1c: true, glucosa_ayuno: true, trigliceridos: true, hdl: true, ldl: true },
      }).catch(() => null),
      prisma.comida.findMany({
        where: { paciente_id: pacienteId, alimento_principal: { not: null } },
        orderBy: { fecha: "desc" },
        take: 30,
        select: { alimento_principal: true },
      }).catch(() => []),
    ]);

    const paciente = pacienteRows[0];
    const frecuentes = [...new Set(
      comidasRows.map((c: { alimento_principal: string | null }) => c.alimento_principal).filter(Boolean) as string[]
    )].slice(0, 10);

    return {
      diagnostico_principal: paciente?.diagnostico_principal ?? null,
      objetivo_clinico: paciente?.objetivo_clinico ?? null,
      sexo: paciente?.sexo ?? null,
      edad: paciente?.edad ?? null,
      motivo_registro: paciente?.motivo_registro ?? null,
      hba1c: labRows?.hba1c ? Number(labRows.hba1c) : null,
      glucosa_ayuno: labRows?.glucosa_ayuno ?? null,
      trigliceridos: labRows?.trigliceridos ?? null,
      hdl: labRows?.hdl ?? null,
      ldl: labRows?.ldl ?? null,
      alimentos_frecuentes: frecuentes,
    };
  } catch (err) {
    console.error("Error global en getPacienteContexto:", err);
    return { alimentos_frecuentes: [] };
  }
}

export async function inferMealFromPhoto(input: z.infer<typeof mealPhotoSchema>) {
  const parsedInput = mealPhotoSchema.safeParse(input);
  if (!parsedInput.success) {
    console.error("[inferMealFromPhoto] invalid_input:", parsedInput.error.flatten());
    return { success: false as const, error: "invalid_input" };
  }

  const isAllowed = await checkRateLimit(`estimate_meal:${parsedInput.data.paciente_id}`);
  if (!isAllowed) {
    console.warn("[inferMealFromPhoto] ai_rate_limited for patient:", parsedInput.data.paciente_id);
    return { success: false as const, error: "ai_rate_limited" };
  }

  try {
    const pacienteContexto = await getPacienteContexto(parsedInput.data.paciente_id);

    const estimate = await estimateMealFromImage({
      imageUrl: parsedInput.data.foto_url,
      locale: parsedInput.data.locale,
      pacienteContexto,
    });
    if (!estimate) {
      console.error("[inferMealFromPhoto] ai_unavailable — estimateMealFromImage returned null. Check AI_GATEWAY_API_KEY and model config.");
      return { success: false as const, error: "ai_unavailable" };
    }

    const alimentoPrincipal = estimate.alimento_principal?.trim() || estimate.meal_description?.split(/[.,]/)[0]?.trim() || null;
    const mealDescription = estimate.meal_description?.trim() || (alimentoPrincipal ? `Plato principal: ${alimentoPrincipal}.` : null);

    return {
      success: true as const,
      data: {
        ...estimate,
        alimento_principal: alimentoPrincipal ?? undefined,
        alimento_principal_razon: estimate.alimento_principal_razon ?? undefined,
        meal_description: mealDescription ?? undefined,
      },
    };
  } catch (error) {
    console.error("inferMealFromPhoto error:", error);
    return { success: false as const, error: "ai_failed" };
  }
}

export async function clasificarYGuardarComida(data: ComidaInput) {
  let aiData: Partial<ComidaInput> = {};

  if (data.foto_url && !data.alimento_principal) {
    const isAllowed = await checkRateLimit(`estimate_meal:${data.paciente_id}`);
    
    let estimate = null;
    if (isAllowed) {
      try {
        const pacienteContexto = await getPacienteContexto(data.paciente_id);
        estimate = await estimateMealFromImage({
          imageUrl: data.foto_url,
          locale: "es",
          pacienteContexto,
        });
      } catch (error) {
        console.error("Error estimando comida con IA:", error);
      }
    } else {
      console.warn("Rate limit exceeded for meal estimation, falling back to manual entry");
    }

    if (estimate) {
      const esValida = estimate.es_comida_valida ?? true;
      const esSaludable = estimate.es_saludable ?? true;
      
      aiData = {
        alimento_principal: estimate.alimento_principal ?? data.alimento_principal,
        kcal_estimadas: estimate.kcal_estimadas ?? data.kcal_estimadas,
        proteina_g: estimate.proteina_g ?? data.proteina_g,
        carbohidratos_g: estimate.carbohidratos_g ?? data.carbohidratos_g,
        grasa_g: estimate.grasa_g ?? data.grasa_g,
        fibra_g: estimate.fibra_g ?? data.fibra_g,
        es_comida_valida: esValida,
        es_saludable: esSaludable,
        razon_inadecuada: estimate.razon_inadecuada ?? undefined,
        alternativa_saludable: estimate.alternativa_saludable ?? undefined,
      };
    }
  }

  const finalData = { ...data, ...aiData };
  const class_proteina = getClasificacionProteina(finalData.proteina_g);
  const class_carbohidrato = getClasificacionCarbohidrato(finalData.carbohidratos_g);
  const class_fibra = getClasificacionFibra(finalData.fibra_g);
  const class_final = getClasificacionFinal(
    class_carbohidrato, 
    class_fibra, 
    class_proteina,
    finalData.es_comida_valida ?? true,
    finalData.es_saludable ?? true,
    finalData.razon_inadecuada
  );

  try {
    const nuevaComida = await prisma.comida.create({
      data: {
        paciente_id: finalData.paciente_id,
        fecha: new Date(finalData.fecha),
        hora: new Date(`1970-01-01T${finalData.hora}:00Z`),
        tipo_comida: finalData.tipo_comida,
        foto_url: finalData.foto_url,
        nota: finalData.nota,
        alimento_principal: finalData.alimento_principal,
        kcal_estimadas: finalData.kcal_estimadas,
        proteina_g: finalData.proteina_g,
        carbohidratos_g: finalData.carbohidratos_g,
        grasa_g: finalData.grasa_g,
        fibra_g: finalData.fibra_g,
        clasificacion_proteina: class_proteina,
        clasificacion_carbohidrato: class_carbohidrato,
        clasificacion_fibra: class_fibra,
        clasificacion_final: class_final,
        razon_inadecuada: finalData.razon_inadecuada ?? null,
        alternativa_saludable: finalData.alternativa_saludable ?? null
      }
    });

    return { success: true, comida: nuevaComida, clasificacion: class_final };
  } catch (error) {
    console.error("Error guardando comida:", error);
    return { success: false, error: "Fallo al guardar" };
  }
}
