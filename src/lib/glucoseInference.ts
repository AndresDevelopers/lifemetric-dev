export type GlucoseMealInput = {
  carbohidratos_g?: number | null;
  fibra_g?: number | null;
  proteina_g?: number | null;
  clasificacion_final?: string | null;
};

const GLUCOSE_BASELINE = 95;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Estimates postprandial glucose trend when explicit glucose logs are missing.
 * This is used only to enrich AI suggestions; it does not overwrite medical records.
 */
export function estimateGlucoseFromMeals(meals: GlucoseMealInput[]): number | null {
  if (!meals.length) return null;

  const estimatedValues = meals.map((meal) => {
    const carbs = meal.carbohidratos_g ?? 0;
    const fiber = meal.fibra_g ?? 0;
    const protein = meal.proteina_g ?? 0;

    const glycemicLoad = carbs - fiber * 0.6 - protein * 0.15;

    let estimated = GLUCOSE_BASELINE + glycemicLoad * 1.15;

    const classification = meal.clasificacion_final?.toLowerCase() ?? '';
    if (classification.includes('pico') || classification.includes('inadecuada')) {
      estimated += 14;
    }
    if (classification.includes('saludable')) {
      estimated -= 6;
    }

    return clamp(Math.round(estimated), 70, 240);
  });

  const total = estimatedValues.reduce((acc, value) => acc + value, 0);
  return Math.round(total / estimatedValues.length);
}
