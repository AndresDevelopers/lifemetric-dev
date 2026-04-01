import { prisma } from "@/lib/prisma";
import {
  serializeMealHistoryEntries,
  type MealHistorySerializableInput,
} from "@/lib/mealHistory";

const SUMMARY_MEAL_HISTORY_DAYS = 30;

export async function getSummaryMealHistory(pacienteId: string) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - SUMMARY_MEAL_HISTORY_DAYS);

  const comidas = await prisma.comida.findMany({
    where: {
      paciente_id: pacienteId,
      fecha: {
        gte: startDate,
      },
    },
    orderBy: [{ fecha: "desc" }, { hora: "desc" }],
    select: {
      comida_id: true,
      fecha: true,
      hora: true,
      tipo_comida: true,
      alimento_principal: true,
      kcal_estimadas: true,
      proteina_g: true,
      carbohidratos_g: true,
      fibra_g: true,
      clasificacion_final: true,
      nota: true,
      foto_url: true,
      razon_inadecuada: true,
      alternativa_saludable: true,
    },
  });

  return serializeMealHistoryEntries(comidas as MealHistorySerializableInput[]);
}
