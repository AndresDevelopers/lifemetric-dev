import { z } from 'zod';
import { getPromoProductGuidance } from '@/lib/productCatalog';

const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const DEFAULT_AI_MODEL = 'google/gemini-2.0-flash-001';


const THERMORUSH_CONTEXT = {
  es: `ThermoRush (gotas de soporte neuro-metabólico): tomar antes de desayuno y almuerzo. Enfoques esperados: señalización de saciedad/apetito, alimentación relacionada con estrés, apoyo metabólico de energía, glucosa, triglicéridos/colesterol. Ingredientes reportados: extracto de té verde (Camellia sinensis), L-carnitina, taurina, rodiola, capsaicinoides y cromo. Mensaje clínico responsable: puede usarse como apoyo en estilo de vida, no reemplaza terapias médicas ni evaluación profesional. Si el paciente usa GLP-1, indicar consulta médica antes de combinar. Evitar prometer resultados garantizados; priorizar lenguaje de apoyo, seguridad y seguimiento clínico.`,
  en: `ThermoRush (neuro-metabolic support drops): taken before breakfast and lunch. Intended areas: appetite/satiety signaling, stress-related eating patterns, metabolic energy support, glucose, triglycerides/cholesterol support. Reported ingredients: green tea extract (Camellia sinensis), L-carnitine, taurine, rhodiola, capsaicinoids, and chromium. Safety framing: can be presented as lifestyle support, not as a replacement for medical therapy or professional evaluation. If the patient is on GLP-1 therapy, advise clinician review before combining. Do not promise guaranteed outcomes; keep supportive and safety-first language.`
};


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
  meal_description: z.string().min(10).max(500).optional(),
});

const suggestionsSchema = z.object({
  summary: z.string(),
  suggestions: z.array(z.string()).max(6),
  importantAlert: z.string().optional(),
  centralProblems: z.array(z.string()).max(5).optional(),
  priorityPlan: z.array(z.string()).max(8).optional(),
  nutritionFocus: z.array(z.string()).max(8).optional(),
  lifestyleFocus: z.array(z.string()).max(8).optional(),
  recommendedLabs: z.array(z.string()).max(8).optional(),
  productsGuidance: z.array(z.string()).max(5).optional(),
  expectedProgress: z.array(z.string()).max(5).optional(),
  patientMessage: z.string().optional(),
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
      ? `Analiza la imagen de comida: ${params.imageUrl}. Notas: ${params.notes ?? 'sin notas'}. Devuelve SOLO JSON con claves alimento_principal, kcal_estimadas, proteina_g, carbohidratos_g, grasa_g, fibra_g y meal_description (descripción clara del plato y sus detalles).`
      : `Analyze this meal image: ${params.imageUrl}. Notes: ${params.notes ?? 'no notes'}. Return ONLY JSON with keys alimento_principal, kcal_estimadas, proteina_g, carbohidratos_g, grasa_g, fibra_g and meal_description (clear plate description with details).`;

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
      ? `Actúa como asistente clínico educativo con enfoque metabólico. Analiza este informe JSON de la última semana: ${JSON.stringify(params.data)}. Usa además este marco de producto para recomendaciones de productos/suplementos: ${THERMORUSH_CONTEXT.es}. ${getPromoProductGuidance('es')} Reglas: 1) Si glucosa_real_registrada es false, usa glucosa_estimada_por_comidas como referencia y deja claro que es estimación por alimentos. 2) Medicación y laboratorios son opcionales: si faltan, no bloquees el análisis; enfócate en comidas, hábitos y glucosa estimada/real. 3) Si sexo biológico es femenino y hay señales de fatiga, baja energía o laboratorio sugestivo, prioriza evaluación de hierro/anemia con lenguaje prudente (sin diagnosticar). 4) Incluye recomendaciones de alimentos, hábitos y seguimiento clínico ordenadas por prioridad. 5) Si existe motivo_registro en el JSON, úsalo para conectar progreso actual con la razón inicial de uso de la app en summary y patientMessage. 6) Si recomiendas ThermoRush, explica dosis (antes del desayuno y almuerzo), objetivo metabólico esperado y que no reemplaza tratamiento médico. 7) Nunca menciones productos restringidos. 8) Tono claro, humano, no alarmista y sin sustituir consulta médica. Devuelve SOLO JSON válido con este formato: {"summary":"...","importantAlert":"... opcional ...","centralProblems":["..."],"priorityPlan":["..."],"nutritionFocus":["..."],"lifestyleFocus":["..."],"recommendedLabs":["..."],"productsGuidance":["..."],"expectedProgress":["..."],"patientMessage":"... opcional ...","suggestions":["...","..."]}. Máximo 6 suggestions.`
      : `Act as an educational metabolic-care assistant. Analyze this weekly JSON report: ${JSON.stringify(params.data)}. Also use this product guidance framework for supplements/products recommendations: ${THERMORUSH_CONTEXT.en}. ${getPromoProductGuidance('en')} Rules: 1) If glucosa_real_registrada is false, use glucosa_estimada_por_comidas and clearly state it is a meal-based estimate. 2) Medication and labs are optional: if missing, still provide actionable analysis from meals/habits/glucose. 3) Prioritize practical recommendations by urgency. 4) If motivo_registro exists in the JSON, connect current progress to the patient's original reason for using the app in summary and patientMessage. 5) If you mention ThermoRush, include timing (before breakfast and lunch), expected metabolic rationale, and that it does not replace medical treatment. 6) Never mention restricted products. 7) Keep a clear, supportive and non-alarmist tone, and never replace medical care. Return ONLY valid JSON with this shape: {"summary":"...","importantAlert":"... optional ...","centralProblems":["..."],"priorityPlan":["..."],"nutritionFocus":["..."],"lifestyleFocus":["..."],"recommendedLabs":["..."],"productsGuidance":["..."],"expectedProgress":["..."],"patientMessage":"... optional ...","suggestions":["...","..."]}. Max 6 suggestions.`;

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
