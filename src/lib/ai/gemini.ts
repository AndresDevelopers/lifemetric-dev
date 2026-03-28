import { z } from 'zod';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const geminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() })),
        }),
      }),
    )
    .optional(),
});

export type GeminiPromptInput = {
  prompt: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export const mealVisionSchema = z.object({
  alimento_principal: z.string().min(2).optional(),
  kcal_estimadas: z.number().int().min(0).max(2500).optional(),
  proteina_g: z.number().min(0).max(300).optional(),
  carbohidratos_g: z.number().min(0).max(400).optional(),
  grasa_g: z.number().min(0).max(250).optional(),
  fibra_g: z.number().min(0).max(120).optional(),
});

const suggestionsSchema = z.object({
  summary: z.string(),
  suggestions: z.array(z.string()).max(5),
});

export const medicationVisionSchema = z.object({
  medicamento: z.string().min(2).optional(),
  descripcion_para_que_sirve: z.string().min(8).optional(),
});

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada.');
  }

  return apiKey;
}

export function canUseGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
}

export async function generateGeminiText(input: GeminiPromptInput, retryCount = 0): Promise<string> {
  const model = input.model ?? getGeminiModel();
  const apiKey = getGeminiApiKey();

  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000; // 1s

  try {
    const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: input.prompt }],
          },
        ],
        generationConfig: {
          temperature: input.temperature ?? 0.3,
          maxOutputTokens: input.maxOutputTokens ?? 512,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Manejo de Error 429 (Rate Limit / Quota Exceeded)
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        // Exponencial backoff con jitter (variación aleatoria)
        const jitter = Math.random() * 500;
        const delay = BASE_DELAY * Math.pow(2, retryCount) + jitter;
        
        console.warn(`Gemini 429 - Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return generateGeminiText(input, retryCount + 1);
      }

      throw new Error(`Gemini error (${response.status}): ${errorText}`);
    }

    const parsed = geminiResponseSchema.parse(await response.json());
    return parsed.candidates?.[0]?.content.parts[0]?.text?.trim() ?? '';
  } catch (error: unknown) {
    if (
      retryCount < MAX_RETRIES &&
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TypeError')
    ) {
      // Reintentar en errores de red transitorios si es posible
      const jitter = Math.random() * 500;
      const delay = BASE_DELAY * Math.pow(2, retryCount) + jitter;
      console.warn(`Gemini network error - Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateGeminiText(input, retryCount + 1);
    }
    throw error;
  }
}

export async function estimateMealFromImage(params: {
  imageUrl: string;
  locale: 'es' | 'en';
  notes?: string;
}): Promise<z.infer<typeof mealVisionSchema> | null> {
  if (!canUseGemini()) return null;

  const prompt =
    params.locale === 'es'
      ? `Analiza la imagen de comida: ${params.imageUrl}. Notas: ${params.notes ?? 'sin notas'}. Devuelve SOLO JSON con claves alimento_principal, kcal_estimadas, proteina_g, carbohidratos_g, grasa_g, fibra_g.`
      : `Analyze this meal image: ${params.imageUrl}. Notes: ${params.notes ?? 'no notes'}. Return ONLY JSON with keys alimento_principal, kcal_estimadas, proteina_g, carbohidratos_g, grasa_g, fibra_g.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 350 });
    const parsedJson = JSON.parse(response);
    return mealVisionSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error estimating meal from image:', error);
    return null;
  }
}

export async function buildClinicalSuggestions(params: {
  locale: 'es' | 'en';
  data: Record<string, unknown>;
}): Promise<z.infer<typeof suggestionsSchema> | null> {
  if (!canUseGemini()) return null;

  const prompt =
    params.locale === 'es'
      ? `Actúa como asistente clínico educativo para diabetes. Con estos datos JSON: ${JSON.stringify(params.data)}. Devuelve SOLO JSON: {"summary":"...","suggestions":["...",...]}. Máximo 4 sugerencias concretas, tono claro y no alarmista.`
      : `Act as an educational diabetes care assistant. Using this JSON data: ${JSON.stringify(params.data)}. Return ONLY JSON: {"summary":"...","suggestions":["...",...]}. Max 4 specific suggestions, clear and non-alarmist tone.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 500 });
    const parsedJson = JSON.parse(response);
    return suggestionsSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error building clinical suggestions:', error);
    return null;
  }
}


export async function estimateMedicationFromImage(params: {
  imageUrl: string;
  locale: 'es' | 'en';
}): Promise<z.infer<typeof medicationVisionSchema> | null> {
  if (!canUseGemini()) return null;

  const prompt =
    params.locale === 'es'
      ? `Analiza la foto de un medicamento: ${params.imageUrl}. Identifica el nombre comercial o genérico más probable y una descripción breve de para qué sirve. Devuelve SOLO JSON con claves medicamento y descripcion_para_que_sirve.`
      : `Analyze this medication photo: ${params.imageUrl}. Identify the most likely brand or generic medication and provide a short description of what it is used for. Return ONLY JSON with keys medicamento and descripcion_para_que_sirve.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 250 });
    const parsedJson = JSON.parse(response);
    return medicationVisionSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error estimating medication from image:', error);
    return null;
  }
}
