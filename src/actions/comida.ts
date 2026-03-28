"use server";

import { prisma } from "@/lib/prisma";
import { estimateMealFromImage } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/redis";

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
}

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

function getClasificacionFinal(carbs: string, fibra: string, proteina: string): string {
  if (carbs === "alto" && fibra === "baja") return "Inadecuada (Pico de Glucosa)";
  if (carbs === "bajo" && proteina === "adecuada") return "Saludable (Bajo índice)";
  return "Regular";
}

export async function clasificarYGuardarComida(data: ComidaInput) {
  let aiData: Partial<ComidaInput> = {};

  if (data.foto_url && (!data.alimento_principal || !data.kcal_estimadas)) {
    const isAllowed = await checkRateLimit(`estimate_meal:${data.paciente_id}`);
    
    let estimate = null;
    if (isAllowed) {
    try {
      estimate = await estimateMealFromImage({
        imageUrl: data.foto_url,
        locale: "es",
        notes: data.nota,
      });
      } catch (error) {
        console.error("Error estimando comida con IA:", error);
      }
    } else {
      console.warn("Rate limit exceeded for meal estimation, falling back to manual entry");
    }

    if (estimate) {
      aiData = {
        alimento_principal: estimate.alimento_principal ?? data.alimento_principal,
        kcal_estimadas: estimate.kcal_estimadas ?? data.kcal_estimadas,
        proteina_g: estimate.proteina_g ?? data.proteina_g,
        carbohidratos_g: estimate.carbohidratos_g ?? data.carbohidratos_g,
        grasa_g: estimate.grasa_g ?? data.grasa_g,
        fibra_g: estimate.fibra_g ?? data.fibra_g,
      };
    }
  }

  const finalData = { ...data, ...aiData };
  const class_proteina = getClasificacionProteina(finalData.proteina_g);
  const class_carbohidrato = getClasificacionCarbohidrato(finalData.carbohidratos_g);
  const class_fibra = getClasificacionFibra(finalData.fibra_g);
  const class_final = getClasificacionFinal(class_carbohidrato, class_fibra, class_proteina);

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
        clasificacion_final: class_final
      }
    });

    return { success: true, comida: nuevaComida, clasificacion: class_final };
  } catch (error) {
    console.error("Error guardando comida:", error);
    return { success: false, error: "Fallo al guardar" };
  }
}
