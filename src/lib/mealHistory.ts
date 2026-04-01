export interface MealHistoryEntry {
  comida_id: string;
  fecha: string;
  hora: string;
  tipo_comida: string;
  alimento_principal: string | null;
  kcal_estimadas: number | null;
  proteina_g: number | null;
  carbohidratos_g: number | null;
  fibra_g: number | null;
  clasificacion_final: string | null;
  nota: string | null;
  foto_url: string | null;
  razon_inadecuada: string | null;
  alternativa_saludable: string | null;
}

export interface MealHistorySerializableInput {
  comida_id: string;
  fecha: Date | string;
  hora: Date | string;
  tipo_comida: string;
  alimento_principal: string | null;
  kcal_estimadas: number | null;
  proteina_g: number | string | null;
  carbohidratos_g: number | string | null;
  fibra_g: number | string | null;
  clasificacion_final: string | null;
  nota: string | null;
  foto_url: string | null;
  razon_inadecuada: string | null;
  alternativa_saludable: string | null;
}

function padTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function formatMealHistoryDate(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getUTCFullYear()}-${padTwoDigits(date.getUTCMonth() + 1)}-${padTwoDigits(date.getUTCDate())}`;
}

export function formatMealHistoryTime(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "00:00";
  }

  return `${padTwoDigits(date.getUTCHours())}:${padTwoDigits(date.getUTCMinutes())}`;
}

export function serializeMealHistoryEntries(
  comidas: readonly MealHistorySerializableInput[],
): MealHistoryEntry[] {
  return comidas.map((comida) => ({
    comida_id: comida.comida_id,
    fecha: formatMealHistoryDate(comida.fecha),
    hora: formatMealHistoryTime(comida.hora),
    tipo_comida: comida.tipo_comida,
    alimento_principal: comida.alimento_principal,
    kcal_estimadas: comida.kcal_estimadas,
    proteina_g: comida.proteina_g != null ? Number(comida.proteina_g) : null,
    carbohidratos_g: comida.carbohidratos_g != null ? Number(comida.carbohidratos_g) : null,
    fibra_g: comida.fibra_g != null ? Number(comida.fibra_g) : null,
    clasificacion_final: comida.clasificacion_final,
    nota: comida.nota,
    foto_url: comida.foto_url,
    razon_inadecuada: comida.razon_inadecuada,
    alternativa_saludable: comida.alternativa_saludable,
  }));
}

export function pickLatestMealHistoryDate(comidas: readonly MealHistoryEntry[]) {
  let latestDate: string | null = null;
  let latestKey = "";

  for (const comida of comidas) {
    const candidateKey = `${comida.fecha}T${comida.hora}`;
    if (candidateKey > latestKey) {
      latestKey = candidateKey;
      latestDate = comida.fecha;
    }
  }

  return latestDate;
}

export function resolveMealHistoryFilterDate(
  currentFilterDate: string | null,
  previousLatestDate: string | null,
  nextComidas: readonly MealHistoryEntry[],
) {
  const nextLatestDate = pickLatestMealHistoryDate(nextComidas);
  if (!nextLatestDate) {
    return null;
  }

  if (!currentFilterDate) {
    return nextLatestDate;
  }

  const currentDateStillExists = nextComidas.some((comida) => comida.fecha === currentFilterDate);
  if (!currentDateStillExists) {
    return nextLatestDate;
  }

  return currentFilterDate === previousLatestDate ? nextLatestDate : currentFilterDate;
}

export function buildMealHistoryFingerprint(comidas: readonly MealHistoryEntry[]) {
  return comidas
    .map((comida) =>
      [
        comida.comida_id,
        comida.fecha,
        comida.hora,
        comida.alimento_principal ?? "",
        comida.nota ?? "",
        comida.foto_url ?? "",
        comida.kcal_estimadas ?? "",
        comida.clasificacion_final ?? "",
        comida.razon_inadecuada ?? "",
      ].join(":"),
    )
    .join("|");
}
