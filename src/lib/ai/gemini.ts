import { z } from 'zod';

const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const DEFAULT_AI_MODEL = 'google/gemini-2.0-flash-001';

const aiGatewayResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([
            z.string(),
            z.array(
              z.object({
                type: z.string().optional(),
                text: z.string().optional(),
              }),
            ),
          ]),
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
  dosis: z.string().optional(),
});

export const labVisionSchema = z.object({
  hba1c: z.number().min(0).max(30).nullable().optional(),
  glucosa_ayuno: z.number().int().min(0).max(1000).nullable().optional(),
  insulina: z.number().min(0).max(500).nullable().optional(),
  trigliceridos: z.number().int().min(0).max(5000).nullable().optional(),
  hdl: z.number().int().min(0).max(500).nullable().optional(),
  ldl: z.number().int().min(0).max(1000).nullable().optional(),
  alt: z.number().int().min(0).max(5000).nullable().optional(),
  ast: z.number().int().min(0).max(5000).nullable().optional(),
  tsh: z.number().min(0).max(100).nullable().optional(),
  pcr_us: z.number().min(0).max(500).nullable().optional(),
  creatinina: z.number().min(0).max(50).nullable().optional(),
  acido_urico: z.number().min(0).max(30).nullable().optional(),
});

function getAIGatewayApiKey(): string {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error('AI_GATEWAY_API_KEY no está configurada.');
  }

  return apiKey;
}

export function canUseGemini(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

export function getGeminiModel(): string {
  return process.env.AI_GATEWAY_MODEL ?? DEFAULT_AI_MODEL;
}

function normalizeContent(content: string | Array<{ type?: string; text?: string }>): string {
  if (typeof content === 'string') return content.trim();

  return content
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join('\n')
    .trim();
}

export async function generateGeminiText(input: GeminiPromptInput, retryCount = 0): Promise<string> {
  const model = input.model ?? getGeminiModel();
  const apiKey = getAIGatewayApiKey();

  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;

  try {
    const response = await fetch(`${AI_GATEWAY_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: input.prompt,
          },
        ],
        temperature: input.temperature ?? 0.3,
        max_tokens: input.maxOutputTokens ?? 512,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const jitter = Math.random() * 500;
        const delay = BASE_DELAY * Math.pow(2, retryCount) + jitter;

        console.warn(
          `AI Gateway 429 - Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return generateGeminiText(input, retryCount + 1);
      }

      throw new Error(`AI Gateway error (${response.status}): ${errorText}`);
    }

    const parsed = aiGatewayResponseSchema.parse(await response.json());
    return normalizeContent(parsed.choices?.[0]?.message.content ?? '');
  } catch (error: unknown) {
    if (
      retryCount < MAX_RETRIES &&
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TypeError')
    ) {
      const jitter = Math.random() * 500;
      const delay = BASE_DELAY * Math.pow(2, retryCount) + jitter;
      console.warn(
        `AI Gateway network error - Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`,
      );
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
      ? `Actúa como asistente clínico educativo especializado en diabetes. Analiza este informe JSON de la última semana: ${JSON.stringify(params.data)}. Tu objetivo es brindar un resumen cálido y empoderador, seguido de sugerencias prácticas. IMPORTANTE: Usa excelente ortografía en español con todas las tildes correspondientes. Devuelve ÚNICAMENTE el siguiente formato JSON: {"summary":"Su resumen cálido y claro aquí...","suggestions":["Sugerencia 1","Sugerencia 2",...]}. Máximo 4 sugerencias concretas, tono claro y no alarmista.`
      : `Act as an educational diabetes care assistant. Analyze this weekly JSON report: ${JSON.stringify(params.data)}. Your goal is to provide a warm and empowering summary followed by practical tips. Return ONLY JSON: {"summary":"Your warm and clear summary here...","suggestions":["Tip 1","Tip 2",...]}. Max 4 specific suggestions, clear and non-alarmist tone.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 500 });
    const parsedJson = JSON.parse(response);
    return suggestionsSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error building clinical suggestions:', error);
    return null;
  }
}

export async function extractLabValuesFromImage(params: {
  imageUrl: string;
  locale: 'es' | 'en';
}): Promise<z.infer<typeof labVisionSchema> | null> {
  if (!canUseGemini()) return null;

  const prompt =
    params.locale === 'es'
      ? `Eres un asistente médico experto en interpretación de resultados de laboratorio. Analiza esta imagen de resultados de laboratorio clínico: ${params.imageUrl}. Extrae únicamente los valores numéricos que encuentres para: HbA1c (%), glucosa en ayuno (mg/dL), insulina (μU/mL), triglicéridos (mg/dL), HDL (mg/dL), LDL (mg/dL), ALT (U/L), AST (U/L), TSH (μIU/mL), PCR-us (mg/L), creatinina (mg/dL), ácido úrico (mg/dL). Si un valor no aparece en la imagen, usa null. Devuelve SOLO JSON válido con las claves: hba1c, glucosa_ayuno, insulina, trigliceridos, hdl, ldl, alt, ast, tsh, pcr_us, creatinina, acido_urico. Sin texto adicional, solo JSON.`
      : `You are a medical assistant expert in interpreting lab results. Analyze this clinical laboratory results image: ${params.imageUrl}. Extract only the numeric values found for: HbA1c (%), fasting glucose (mg/dL), insulin (μU/mL), triglycerides (mg/dL), HDL (mg/dL), LDL (mg/dL), ALT (U/L), AST (U/L), TSH (μIU/mL), hsCRP (mg/L), creatinine (mg/dL), uric acid (mg/dL). If a value does not appear in the image use null. Return ONLY valid JSON with keys: hba1c, glucosa_ayuno, insulina, trigliceridos, hdl, ldl, alt, ast, tsh, pcr_us, creatinina, acido_urico. No extra text, just JSON.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.1, maxOutputTokens: 400 });
    const clean = response.replace(/```json|```/g, '').trim();
    const parsedJson = JSON.parse(clean);
    return labVisionSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error extracting lab values from image:', error);
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
      ? `Analiza la foto de un medicamento: ${params.imageUrl}. Identifica el nombre comercial o genérico más probable, la dosis si aparece, y una descripción breve de para qué sirve. Devuelve SOLO JSON con claves medicamento, descripcion_para_que_sirve y dosis.`
      : `Analyze this medication photo: ${params.imageUrl}. Identify the most likely brand or generic medication, the dose if visible, and provide a short description of what it is used for. Return ONLY JSON with keys medicamento, descripcion_para_que_sirve and dosis.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 250 });
    const parsedJson = JSON.parse(response);
    return medicationVisionSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error estimating medication from image:', error);
    return null;
  }
}
