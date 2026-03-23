"use server";

import { prisma } from "@/lib/prisma";

interface ComidaInput {
  paciente_id: string;
  fecha: string;
  hora: string;
  tipo_comida: string;
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
  const class_proteina = getClasificacionProteina(data.proteina_g);
  const class_carbohidrato = getClasificacionCarbohidrato(data.carbohidratos_g);
  const class_fibra = getClasificacionFibra(data.fibra_g);
  const class_final = getClasificacionFinal(class_carbohidrato, class_fibra, class_proteina);

  try {
    const nuevaComida = await prisma.comida.create({
      data: {
        paciente_id: data.paciente_id,
        fecha: new Date(data.fecha),
        hora: new Date(`1970-01-01T${data.hora}:00Z`),
        tipo_comida: data.tipo_comida,
        nota: data.nota,
        alimento_principal: data.alimento_principal,
        kcal_estimadas: data.kcal_estimadas,
        proteina_g: data.proteina_g,
        carbohidratos_g: data.carbohidratos_g,
        grasa_g: data.grasa_g,
        fibra_g: data.fibra_g,
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
