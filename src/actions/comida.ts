"use server";

import { prisma } from "@/lib/prisma";

export async function clasificarYGuardarComida(data: any) {
  // Lógica de clasificación (MVP Médico)
  
  let class_proteina = "desconocida";
  if (data.proteina_g !== undefined) {
    class_proteina = data.proteina_g < 20 ? "baja" : "adecuada";
  }

  let class_carbohidrato = "desconocido";
  if (data.carbohidratos_g !== undefined) {
    if (data.carbohidratos_g > 45) class_carbohidrato = "alto";
    else if (data.carbohidratos_g >= 25 && data.carbohidratos_g <= 45) class_carbohidrato = "moderado";
    else class_carbohidrato = "bajo";
  }

  let class_fibra = "desconocida";
  if (data.fibra_g !== undefined) {
    class_fibra = data.fibra_g < 5 ? "baja" : "adecuada";
  }

  let class_final = "Pendiente";
  if (class_carbohidrato === "alto" && class_fibra === "baja") {
    class_final = "Inadecuada (Pico de Glucosa)";
  } else if (class_carbohidrato === "bajo" && class_proteina === "adecuada") {
    class_final = "Saludable (Bajo índice)";
  } else {
    class_final = "Regular";
  }

  try {
    const nuevaComida = await prisma.comida.create({
      data: {
        paciente_id: data.paciente_id,
        fecha: new Date(data.fecha),
        hora: new Date(`1970-01-01T${data.hora}:00Z`), // parse simple
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
