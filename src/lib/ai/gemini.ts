import { z } from 'zod';
import { getPromoProductGuidance } from '@/lib/productCatalog';

const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const GEMINI_DIRECT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_AI_GATEWAY_MODEL = 'google/gemini-3-flash';
const DEFAULT_GEMINI_DIRECT_MODEL = 'gemini-3-flash';


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
  imageUrl?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export const mealVisionSchema = z.object({
  es_comida_valida: z.boolean().nullish(),
  es_saludable: z.boolean().nullish(),
  alimento_principal: z.string().nullish(),
  alimento_principal_razon: z.string().max(300).nullish(),
  razon_inadecuada: z.string().max(300).nullish(),
  alternativa_saludable: z.string().max(300).nullish(),
  kcal_estimadas: z.number().min(0).max(2500).nullish(),
  proteina_g: z.number().min(0).max(300).nullish(),
  carbohidratos_g: z.number().min(0).max(400).nullish(),
  grasa_g: z.number().min(0).max(250).nullish(),
  fibra_g: z.number().min(0).max(120).nullish(),
  meal_description: z.string().max(600).nullish(),
});

export type PacienteContexto = {
  diagnostico_principal?: string | null;
  objetivo_clinico?: string | null;
  sexo?: string | null;
  edad?: number | null;
  hba1c?: number | null;
  glucosa_ayuno?: number | null;
  trigliceridos?: number | null;
  hdl?: number | null;
  ldl?: number | null;
  alimentos_frecuentes?: string[];
  motivo_registro?: string | null;
};

const suggestionsSchema = z.object({
  summary: z.string(),
  suggestions: z.array(z.string()).max(6),
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

type ApiConfig = { apiKey: string; baseUrl: string; model: string };

function getApiConfig(): ApiConfig {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (gatewayKey) {
    return {
      apiKey: gatewayKey,
      baseUrl: AI_GATEWAY_BASE_URL,
      model: process.env.AI_GATEWAY_MODEL ?? DEFAULT_AI_GATEWAY_MODEL,
    };
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      apiKey: geminiKey,
      baseUrl: GEMINI_DIRECT_BASE_URL,
      model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_DIRECT_MODEL,
    };
  }
  throw new Error('No AI API key configured. Set AI_GATEWAY_API_KEY or GEMINI_API_KEY in .env.local.');
}

export function canUseGemini(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.GEMINI_API_KEY);
}

export function getGeminiModel(): string {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_MODEL ?? DEFAULT_AI_GATEWAY_MODEL;
  return process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_DIRECT_MODEL;
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
  const cfg = getApiConfig();
  const model = input.model ?? cfg.model;
  const apiKey = cfg.apiKey;
  const baseUrl = cfg.baseUrl;

  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;

  try {
    let finalImageUrl = input.imageUrl;
    let base64Data = '';
    let imageMimeType = 'image/jpeg';

    if (finalImageUrl) {
      if (finalImageUrl.startsWith("http")) {
        try {
          const imgRes = await fetch(finalImageUrl, { signal: AbortSignal.timeout(15000) });
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            base64Data = Buffer.from(buffer).toString("base64");
            imageMimeType = imgRes.headers.get("content-type") || "image/jpeg";
            finalImageUrl = `data:${imageMimeType};base64,${base64Data}`;
          }
        } catch (e) {
          console.warn("Could not fetch image to convert to base64", e);
        }
      } else if (finalImageUrl.startsWith("data:")) {
        const match = finalImageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          imageMimeType = match[1];
          base64Data = match[2];
        }
      }
    }

    const isDirectGoogleApi = baseUrl === GEMINI_DIRECT_BASE_URL;

    let requestUrl = '';
    const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    let requestBody: Record<string, unknown> = {};

    if (isDirectGoogleApi) {
      requestUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
      const parts: Record<string, unknown>[] = [{ text: input.prompt }];
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: base64Data,
          },
        });
      }
      requestBody = {
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: input.temperature ?? 0.3,
          maxOutputTokens: input.maxOutputTokens ?? 512,
        },
      };
    } else {
      requestUrl = `${baseUrl}/chat/completions`;
      requestHeaders['Authorization'] = `Bearer ${apiKey}`;
      requestBody = {
        model,
        messages: [
          {
            role: 'user',
            content: finalImageUrl
              ? [
                  { type: 'text', text: input.prompt },
                  { type: 'image_url', image_url: { url: finalImageUrl } },
                ]
              : input.prompt,
          },
        ],
        temperature: input.temperature ?? 0.3,
        max_tokens: input.maxOutputTokens ?? 512,
      };
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        const jitter = Math.random() * 500;
        const delay = BASE_DELAY * Math.pow(2, retryCount) + jitter;

        console.warn(
          `AI API 429 - Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return generateGeminiText(input, retryCount + 1);
      }

      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();

    if (isDirectGoogleApi) {
      return responseData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } else {
      const parsed = aiGatewayResponseSchema.parse(responseData);
      return normalizeContent(parsed.choices?.[0]?.message.content ?? '');
    }
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

// ---------------------------------------------------------------------------
// Meal vision helpers — extracted to keep estimateMealFromImage complexity ≤15
// ---------------------------------------------------------------------------

function buildContextBlock(ctx: PacienteContexto, locale: 'es' | 'en'): string {
  const parts: string[] = [];

  const t = (es: string, en: string) => (locale === 'es' ? es : en);

  if (ctx.diagnostico_principal) parts.push(t(`Diagnóstico: ${ctx.diagnostico_principal}`, `Diagnosis: ${ctx.diagnostico_principal}`));
  if (ctx.objetivo_clinico) parts.push(t(`Objetivo clínico: ${ctx.objetivo_clinico}`, `Clinical goal: ${ctx.objetivo_clinico}`));
  if (ctx.motivo_registro) parts.push(t(`Motivo de registro: ${ctx.motivo_registro}`, `Registration reason: ${ctx.motivo_registro}`));
  if (ctx.sexo) parts.push(t(`Sexo: ${ctx.sexo}`, `Sex: ${ctx.sexo}`));
  if (ctx.edad) parts.push(t(`Edad: ${ctx.edad} años`, `Age: ${ctx.edad} years`));

  const labs: string[] = [];
  if (ctx.hba1c != null) labs.push(`HbA1c ${ctx.hba1c}%`);
  if (ctx.glucosa_ayuno != null) labs.push(`Glucosa ayuno ${ctx.glucosa_ayuno} mg/dL`);
  if (ctx.trigliceridos != null) labs.push(`Triglicéridos ${ctx.trigliceridos} mg/dL`);
  if (ctx.hdl != null) labs.push(`HDL ${ctx.hdl} mg/dL`);
  if (ctx.ldl != null) labs.push(`LDL ${ctx.ldl} mg/dL`);
  if (labs.length > 0) parts.push(t(`Últimos laboratorios: ${labs.join(', ')}`, `Recent labs: ${labs.join(', ')}`));

  const foods = ctx.alimentos_frecuentes?.slice(0, 8) ?? [];
  if (foods.length > 0) parts.push(t(`Alimentos frecuentes: ${foods.join(', ')}`, `Frequently logged foods: ${foods.join(', ')}`));

  return parts.join('. ');
}

function buildMealPrompt(contextBlock: string, notes: string, locale: 'es' | 'en'): string {
  let profileSection = '';
  if (contextBlock && locale === 'es') {
    profileSection = ` PERFIL DEL PACIENTE: ${contextBlock}.`;
  } else if (contextBlock) {
    profileSection = ` PATIENT PROFILE: ${contextBlock}.`;
  }
  const notesSection = notes || (locale === 'es' ? 'sin notas' : 'no notes');

  if (locale === 'es') {
    return (
      `Eres un asistente clínico-nutricional experto. Analiza la imagen adjunta.${profileSection} Notas adicionales: ${notesSection}.\n\n` +
      'TAREA PRINCIPAL: Primero evalúa si la imagen muestra una COMIDA real (plato de comida, bebida, snack alimenticio). Si NO es una comida válida (es un objeto, documento, paisaje, persona sin comida, etc.), marca es_comida_valida: false y NO analices valores nutricionales.\n' +
      'Si es una comida válida, evalúa si es_saludable considerando el PERFIL CLÍNICO DEL PACIENTE (laboratorios):\n' +
      '- Si HbA1c > 5.7% o glucosa ayuno > 100 mg/dL (diabetes/prediabetes): evitar alimentos de alto índice glucémico, carbohidratos refinados, azúcares\n' +
      '- Si triglicéridos > 150 mg/dL: evitar grasas saturadas, alimentos ultraprocesados, frituras\n' +
      '- Si HDL bajo (<40 hombres/<50 mujeres): priorizar grasas saludables, proteínas\n' +
      '- Si LDL alto (>100 mg/dL): evitar grasas trans, alimentos fritos\n' +
      'Si es_saludable es false, proporciona alternativa_saludable: una opción más saludable que el paciente puede comer en lugar de este alimento, considerando sus laboratorios específicos.\n' +
      'Usa los valores de laboratorio del paciente para personalizar la evaluación. Si no hay laboratorios, usa criterios generales de alimentación saludable.\n\n' +
      'Devuelve SOLO JSON válido con: es_comida_valida, es_saludable, alimento_principal, alimento_principal_razon (max 150 chars), razon_inadecuada (max 150 chars si es_saludable es false, explica según los laboratorios del paciente), alternativa_saludable (max 150 chars si es_saludable es false), meal_description, kcal_estimadas, proteina_g, carbohidratos_g, grasa_g, fibra_g. Sin texto adicional.'
    );
  }
  return (
    `You are a clinical nutrition expert assistant. Analyze the attached image.${profileSection} Additional notes: ${notesSection}.\n\n` +
    'MAIN TASK: First evaluate if the image shows a real FOOD (food plate, drink, food snack). If it is NOT a valid meal (it is an object, document, landscape, person without food, etc.), set es_comida_valida: false and do NOT analyze nutritional values.\n' +
    'If it is a valid food, evaluate if es_saludable considering the PATIENT CLINICAL PROFILE (laboratories):\n' +
    '- If HbA1c > 5.7% or fasting glucose > 100 mg/dL (diabetes/prediabetes): avoid high glycemic index foods, refined carbs, sugars\n' +
    '- If triglycerides > 150 mg/dL: avoid saturated fats, ultra-processed foods, fried foods\n' +
    '- If HDL low (<40 men/<50 women): prioritize healthy fats, proteins\n' +
    '- If LDL high (>100 mg/dL): avoid trans fats, fried foods\n' +
    'If es_saludable is false, provide alternativa_saludable: a healthier option the patient can eat instead of this food, considering their specific labs.\n' +
    'Use the patient laboratory values to personalize the evaluation. If no labs, use general healthy eating criteria.\n\n' +
    'Return ONLY valid JSON with: es_comida_valida, es_saludable, alimento_principal, alimento_principal_razon (max 150 chars), razon_inadecuada (max 150 chars if es_saludable is false, explain based on patient labs), alternativa_saludable (max 150 chars if es_saludable is false), meal_description, kcal_estimadas, proteina_g, carbohidratos_g, grasa_g, fibra_g. No extra text.'
  );
}

export async function estimateMealFromImage(params: {
  imageUrl: string;
  locale: 'es' | 'en';
  notes?: string;
  pacienteContexto?: PacienteContexto;
}): Promise<z.infer<typeof mealVisionSchema> | null> {
  if (!canUseGemini()) return null;

  const ctx = params.pacienteContexto;
  const hasContext = ctx != null && Object.values(ctx).some(
    (v) => v != null && (!Array.isArray(v) || v.length > 0)
  );
  const contextBlock = hasContext && ctx ? buildContextBlock(ctx, params.locale) : '';
  const prompt = buildMealPrompt(contextBlock, params.notes ?? '', params.locale);

  try {
    const response = await generateGeminiText({
      prompt,
      imageUrl: params.imageUrl,
      temperature: 0.2,
      maxOutputTokens: 600,
    });
    const clean = response.replaceAll('```json', '').replaceAll('```', '').trim();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(clean);
    } catch {
      console.error('[estimateMealFromImage] JSON.parse failed. Raw AI response:', clean);
      return null;
    }
    const result = mealVisionSchema.safeParse(parsedJson);
    if (!result.success) {
      console.error('[estimateMealFromImage] Schema validation failed:', result.error.flatten(), '— raw JSON:', parsedJson);
      return null;
    }
    return result.data;
  } catch (error: unknown) {
    console.error('Error estimating meal from image:', error);
    return null;
  }
}

export async function buildClinicalSuggestions(params: {
  locale: 'es' | 'en';
  data: Record<string, unknown>;
}): Promise<z.infer<typeof suggestionsSchema> | null> {
  if (!canUseGemini()) return null;

  // Extraer datos de laboratorio para contexto prioritario
  const labs = params.data.laboratorios as Array<{
    fecha: string;
    hba1c: number | null;
    glucosa_ayuno: number | null;
    trigliceridos: number | null;
    hdl: number | null;
    ldl: number | null;
    insulina: number | null;
    alt: number | null;
    ast: number | null;
    tsh: number | null;
    creatinina: number | null;
    acido_urico: number | null;
    pcr_us: number | null;
  }> | null;
  
  const tieneLabClaro = labs && labs.length > 0 && labs.some(l => 
    l.hba1c != null || l.glucosa_ayuno != null || l.trigliceridos != null || l.hdl != null || l.ldl != null
  );

  // Construir contexto de laboratorio más detallado
  const labContextBlock = tieneLabClaro ? ` DATOS DE LABORATORIO DISPONIBLES: El paciente tiene estudios recientes. ` +
    labs.filter(l => l.hba1c != null || l.glucosa_ayuno != null || l.trigliceridos != null || l.hdl != null || l.ldl != null || l.insulina != null || l.alt != null || l.ast != null).map(l => 
      `Fecha ${l.fecha}: HbA1c ${l.hba1c ?? 'N/D'}%, Glucosa ayuno ${l.glucosa_ayuno ?? 'N/D'} mg/dL, Triglicéridos ${l.trigliceridos ?? 'N/D'} mg/dL, HDL ${l.hdl ?? 'N/D'} mg/dL, LDL ${l.ldl ?? 'N/D'} mg/dL` +
      (l.insulina != null ? `, Insulina ${l.insulina} μU/mL` : '') +
      (l.alt != null ? `, ALT ${l.alt} U/L` : '') +
      (l.ast != null ? `, AST ${l.ast} U/L` : '') +
      (l.tsh != null ? `, TSH ${l.tsh} μIU/mL` : '') +
      (l.creatinina != null ? `, Creatinina ${l.creatinina} mg/dL` : '') +
      (l.acido_urico != null ? `, Ácido úrico ${l.acido_urico} mg/dL` : '') +
      (l.pcr_us != null ? `, PCR-us ${l.pcr_us} mg/L` : '')
    ).join('. ') + `. Prioriza recomendaciones según estos valores reales del paciente.` : '';

  const prompt =
    params.locale === 'es'
      ? `Actúa como asistente clínico educativo con enfoque metabólico. ${labContextBlock} Analiza este informe JSON de la última semana: ${JSON.stringify(params.data)}. Usa además este marco de producto para recomendaciones de productos/suplementos: ${THERMORUSH_CONTEXT.es}. ${getPromoProductGuidance('es')} Reglas: ${tieneLabClaro ? `PRIORIDAD: Tienes datos de laboratorio claros (HbA1c, glucosa ayuno, perfil lipídico). Usa estos valores como base para personalizar recomendaciones clínicas específicas según los valores reales del paciente. ` : ''}1) Si glucosa_real_registrada es false, usa glucosa_estimada_por_comidas como referencia y deja claro que es estimación por alimentos. 2) Medicación y laboratorios son opcionales: si faltan, no bloquees el análisis; enfócate en comidas, hábitos y glucosa estimada/real. 3) En comidas_recientes prioriza siempre alimento_principal y nota para personalizar el análisis nutricional. 4) Si hay comidas_inadecuadas en el JSON, el paciente debe saber cuáles fueron esas comidas y por qué no son recomendadas. En patientMessage, menciona las comidas inadecuadas específicas que el paciente registró (alimento_principal y fecha) y ofrece alternativas más saludables. 5) Si sexo biológico es femenino y hay señales de fatiga, baja energía o laboratorio sugestivo, prioriza evaluación de hierro/anemia con lenguaje prudente (sin diagnosticar). 6) Incluye recomendaciones de alimentos, hábitos y seguimiento clínico ordenadas por prioridad. 7) Si existe motivo_registro en el JSON, úsalo para conectar progreso actual con la razón inicial de uso de la app en summary y patientMessage. 8) Si recomiendas ThermoRush, explica dosis (antes del desayuno y almuerzo), objetivo metabólico esperado y que no reemplaza tratamiento médico. 9) Nunca menciones productos restringidos. 10) Tono claro, humano, no alarmista y sin sustituir consulta médica. Devuelve SOLO JSON válido con este formato: {"summary":"...","centralProblems":["..."],"priorityPlan":["..."],"nutritionFocus":["..."],"lifestyleFocus":["..."],"recommendedLabs":["..."],"productsGuidance":["..."],"expectedProgress":["..."],"patientMessage":"... opcional ...","suggestions":["...","..."]}. Máximo 6 suggestions.`
      : `Act as an educational metabolic-care assistant. ${labContextBlock ? labContextBlock.replace('DATOS DE LABORATORIO', 'LAB DATA').replace('El paciente tiene estudios recientes', 'The patient has recent studies').replace('Prioriza recomendaciones según estos valores reales del paciente', 'Prioritize recommendations based on these actual values') : ''} Analyze this weekly JSON report: ${JSON.stringify(params.data)}. Also use this product guidance framework for supplements/products recommendations: ${THERMORUSH_CONTEXT.en}. ${getPromoProductGuidance('en')} Rules: ${tieneLabClaro ? `PRIORITY: You have clear laboratory data (HbA1c, fasting glucose, lipid profile, insulin, liver enzymes, thyroid, kidney function and inflammation markers). Use these actual values as the primary basis to personalize clinical recommendations specific to the patient's real laboratory results. ` : ''}1) If glucosa_real_registrada is false, use glucosa_estimada_por_comidas and clearly state it is a meal-based estimate. 2) Medication and labs are optional: if missing, still provide actionable analysis from meals/habits/glucose. 3) In comidas_recientes, always prioritize alimento_principal and nota to personalize nutrition guidance. 4) If there are comidas_inadecuadas in the JSON, the patient needs to know which meals were inadequate and why. In patientMessage, mention the specific inadequate meals the patient logged (alimento_principal and fecha) and offer healthier alternatives. 5) Prioritize practical recommendations by urgency. 6) If motivo_registro exists in the JSON, connect current progress to the patient's original reason for using the app in summary and patientMessage. 7) If you mention ThermoRush, include timing (before breakfast and lunch), expected metabolic rationale, and that it does not replace medical treatment. 8) Never mention restricted products. 9) Keep a clear, supportive and non-alarmist tone, and never replace medical care. Return ONLY valid JSON with this shape: {"summary":"...","centralProblems":["..."],"priorityPlan":["..."],"nutritionFocus":["..."],"lifestyleFocus":["..."],"recommendedLabs":["..."],"productsGuidance":["..."],"expectedProgress":["..."],"patientMessage":"... optional ...","suggestions":["...","..."]}. Max 6 suggestions.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 1024 });
    const clean = response.replaceAll('```json', '').replaceAll('```', '').trim();
    
    // Debug: log de la respuesta cruda
    console.log('[buildClinicalSuggestions] Raw AI response:', clean);
    
    // Intentar parsear, si falla intentar corregir errores menores de JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(clean);
    } catch (parseError) {
      // Intentar corregir JSON truncado o con errores menores
      console.warn('[buildClinicalSuggestions] JSON parse failed, attempting recovery:', parseError);
      
      // Buscar el último cierre válido de array u objeto
      let bestIndex = -1;
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\' && inString) {
          escapeNext = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
        
        // Si encontramos un cierre que balanced el JSON, guardamos la posición
        if ((char === '}' || char === ']') && braceCount === 0 && bracketCount === 0) {
          bestIndex = i;
        }
      }
      
      if (bestIndex > 0) {
        const truncated = clean.substring(0, bestIndex + 1);
        console.log('[buildClinicalSuggestions] Attempting with truncated:', truncated);
        try {
          parsedJson = JSON.parse(truncated);
        } catch {
          console.error('[buildClinicalSuggestions] Recovery failed, returning null');
          return null;
        }
      } else {
        return null;
      }
    }
    
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
      ? `Eres un asistente médico experto en interpretación de resultados de laboratorio. Analiza la imagen adjunta de resultados de laboratorio clínico. Extrae únicamente los valores numéricos que encuentres para: HbA1c (%), glucosa en ayuno (mg/dL), insulina (μU/mL), triglicéridos (mg/dL), HDL (mg/dL), LDL (mg/dL), ALT (U/L), AST (U/L), TSH (μIU/mL), PCR-us (mg/L), creatinina (mg/dL), ácido úrico (mg/dL). Si un valor no aparece en la imagen, usa null. Devuelve SOLO JSON válido con las claves: hba1c, glucosa_ayuno, insulina, trigliceridos, hdl, ldl, alt, ast, tsh, pcr_us, creatinina, acido_urico. Sin texto adicional, solo JSON.`
      : `You are a medical assistant expert in interpreting lab results. Analyze the attached clinical laboratory results image. Extract only the numeric values found for: HbA1c (%), fasting glucose (mg/dL), insulin (μU/mL), triglycerides (mg/dL), HDL (mg/dL), LDL (mg/dL), ALT (U/L), AST (U/L), TSH (μIU/mL), hsCRP (mg/L), creatinine (mg/dL), uric acid (mg/dL). If a value does not appear in the image use null. Return ONLY valid JSON with keys: hba1c, glucosa_ayuno, insulina, trigliceridos, hdl, ldl, alt, ast, tsh, pcr_us, creatinina, acido_urico. No extra text, just JSON.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.1, maxOutputTokens: 400 });
    const clean = response.replaceAll('```json', '').replaceAll('```', '').trim();
    
    // Debug: Log the raw response
    console.log('[extractLabValuesFromImage] Raw AI response:', clean);
    
    const parsedJson = JSON.parse(clean);
    console.log('[extractLabValuesFromImage] Parsed JSON:', parsedJson);
    
    return labVisionSchema.parse(parsedJson);
  } catch (error) {
    console.error('[extractLabValuesFromImage] Error:', error);
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
    const clean = response.replaceAll('```json', '').replaceAll('```', '').trim();
    const parsedJson = JSON.parse(clean);
    return medicationVisionSchema.parse(parsedJson);
  } catch (error) {
    console.error('Error estimating medication from image:', error);
    return null;
  }
}
