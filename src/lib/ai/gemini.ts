import { z } from 'zod';
import { getPromoProductGuidance } from '@/lib/productCatalog';
import {
  buildStandardDetectedResults,
  detectedLabResultsSchema,
  extractStandardLabValuesFromText,
  type StandardLabFieldKey,
  type StandardLabValues,
} from "@/lib/labResults";
import { createSupabaseServerClient } from "@/lib/supabase";
import { readFileSync } from "node:fs";
import path from "node:path";

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
  ultima_glucosa?: { valor: number; tipo: string; fecha: string; } | null;
};

const ensureArray = (val: unknown) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') return [val];
  if (Array.isArray(val)) return val;
  return [];
};

const suggestionsSchema = z.object({
  summary: z.string(),
  suggestions: z.preprocess(ensureArray, z.array(z.string()).max(6)),
  importantAlert: z.string().optional(),
  centralProblems: z.preprocess(ensureArray, z.array(z.string()).max(5).optional()),
  priorityPlan: z.preprocess(ensureArray, z.array(z.string()).max(8).optional()),
  nutritionFocus: z.preprocess(ensureArray, z.array(z.string()).max(8).optional()),
  lifestyleFocus: z.preprocess(ensureArray, z.array(z.string()).max(8).optional()),
  recommendedLabs: z.preprocess(ensureArray, z.array(z.string()).max(8).optional()),
  productsGuidance: z.preprocess(ensureArray, z.array(z.string()).max(5).optional()),
  expectedProgress: z.preprocess(ensureArray, z.array(z.string()).max(5).optional()),
  patientMessage: z.string().optional(),
  evolutionMessage: z.string().optional(),
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
  resultados_detectados: detectedLabResultsSchema.optional().default([]),
});

const standardLabLabels = {
  hba1c: "HbA1c",
  fastingGlucose: "Glucosa en ayuno",
  triglycerides: "Triglicéridos",
  hdl: "HDL",
  ldl: "LDL",
  insulin: "Insulina",
  alt: "ALT",
  ast: "AST",
  tsh: "TSH",
  creatinine: "Creatinina",
  uricAcid: "Ácido úrico",
  pcr_us: "PCR-us",
} as const;

type PdfParseInstance = {
  getText: () => Promise<{ text?: string | null }>;
  destroy: () => Promise<void>;
};

type PdfParseConstructor = {
  new (options: { data: Buffer }): PdfParseInstance;
  setWorker: (workerSource: string) => void;
};

let pdfParseConstructor: PdfParseConstructor | null = null;
let pdfWorkerConfigured = false;

async function getPdfParseConstructor(): Promise<PdfParseConstructor> {
  if (pdfParseConstructor) {
    return pdfParseConstructor;
  }

  const module = await import("pdf-parse");
  const constructor = (module as { PDFParse: PdfParseConstructor }).PDFParse;

  if (!pdfWorkerConfigured) {
    try {
      const workerPath = path.join(process.cwd(), "node_modules", "pdf-parse", "dist", "worker", "pdf.worker.mjs");
      const workerSource = readFileSync(workerPath);
      const workerDataUrl = `data:text/javascript;base64,${workerSource.toString("base64")}`;
      constructor.setWorker(workerDataUrl);
      pdfWorkerConfigured = true;
    } catch (error) {
      console.warn("[configurePdfWorker] Could not configure pdf worker explicitly", error);
    }
  }

  pdfParseConstructor = constructor;
  return pdfParseConstructor;
}

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

function parsePossiblyStringifiedJson(input: string): unknown {
  const firstPass = JSON.parse(input);

  if (typeof firstPass !== "string") {
    return firstPass;
  }

  const unwrapped = firstPass.trim();
  if (!(unwrapped.startsWith("{") || unwrapped.startsWith("["))) {
    return firstPass;
  }

  return JSON.parse(unwrapped);
}

function isPdfUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

async function extractPdfTextFromUrl(url: string): Promise<string | null> {
  const parsePdfBuffer = async (buffer: Buffer, contentType?: string) => {
    const PDFParse = await getPdfParseConstructor();
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const text = result.text?.trim();
    console.log("[extractPdfTextFromUrl] PDF text extracted", {
      url,
      contentType: contentType ?? "unknown",
      textLength: text?.length ?? 0,
    });

    return text && text.length > 0 ? text : null;
  };

  const tryDownloadFromSupabase = async () => {
    try {
      const parsedUrl = new URL(url);
      const storageMarker = "/storage/v1/object/public/";
      const markerIndex = parsedUrl.pathname.indexOf(storageMarker);
      if (markerIndex < 0) {
        return null;
      }

      const storagePath = parsedUrl.pathname.slice(markerIndex + storageMarker.length);
      const [bucket, ...objectParts] = storagePath.split("/").filter(Boolean);
      const objectPath = objectParts.join("/");
      if (!bucket || !objectPath) {
        return null;
      }

      const supabase = createSupabaseServerClient({ useServiceRole: true });
      const { data, error } = await supabase.storage.from(bucket).download(objectPath);
      if (error || !data) {
        console.warn("[extractPdfTextFromUrl] Supabase download failed", {
          url,
          bucket,
          objectPath,
          error: error?.message,
        });
        return null;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      return parsePdfBuffer(buffer, data.type);
    } catch (error) {
      console.warn("[extractPdfTextFromUrl] Supabase fallback failed", error);
      return null;
    }
  };

  try {
    if (!isPdfUrl(url)) {
      return null;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.ok) {
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
        const isPdf = contentType.includes("application/pdf") || isPdfUrl(url);
        if (!isPdf) {
          console.warn("[extractPdfTextFromUrl] Response is not a PDF", {
            url,
            contentType,
          });
          break;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const parsed = await parsePdfBuffer(buffer, contentType);
        if (parsed) {
          return parsed;
        }
      } else {
        console.warn("[extractPdfTextFromUrl] PDF fetch failed", {
          url,
          attempt,
          status: response.status,
          statusText: response.statusText,
        });
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }

    return tryDownloadFromSupabase();
  } catch (error) {
    console.warn("[extractPdfTextFromUrl] Could not extract PDF text", error);
    return tryDownloadFromSupabase();
  }
}

function hasAnyStandardLabValue(values: StandardLabValues): boolean {
  return Object.values(values).some((value) => value != null);
}

const standardLabFieldKeys = [
  "hba1c",
  "glucosa_ayuno",
  "insulina",
  "trigliceridos",
  "hdl",
  "ldl",
  "alt",
  "ast",
  "tsh",
  "pcr_us",
  "creatinina",
  "acido_urico",
] as const satisfies readonly StandardLabFieldKey[];

function sanitizeStandardLabValues(values: StandardLabValues): StandardLabValues {
  const sanitized: StandardLabValues = {};

  for (const key of standardLabFieldKeys) {
    const value = values[key];
    if (value == null) {
      continue;
    }

    const parsedValue = labVisionSchema.shape[key].safeParse(value);
    if (parsedValue.success) {
      sanitized[key] = parsedValue.data;
      continue;
    }

    console.warn("[sanitizeStandardLabValues] Discarding out-of-range standard lab value", {
      key,
      value,
    });
  }

  return sanitized;
}

function mergeStandardLabValues(
  aiValues: StandardLabValues,
  extractedPdfValues: StandardLabValues,
): StandardLabValues {
  const merged: StandardLabValues = {};

  for (const key of standardLabFieldKeys) {
    merged[key] = aiValues[key] ?? extractedPdfValues[key];
  }

  return sanitizeStandardLabValues(merged);
}

function buildLabFallbackResult(values: StandardLabValues) {
  const sanitizedValues = sanitizeStandardLabValues(values);

  return labVisionSchema.parse({
    ...sanitizedValues,
    resultados_detectados: buildStandardDetectedResults(sanitizedValues, standardLabLabels),
  });
}

function buildStandardLabPrompt(locale: 'es' | 'en', sourceText?: string) {
  if (locale === 'es') {
    return `Eres un asistente médico experto en interpretación de resultados de laboratorio. Extrae SOLO estos campos estándar del documento: hba1c, glucosa_ayuno, insulina, trigliceridos, hdl, ldl, alt, ast, tsh, pcr_us, creatinina, acido_urico.

Reglas:
1. Devuelve únicamente JSON válido.
2. Usa número cuando encuentres el resultado exacto.
3. Usa null si el examen no contiene ese campo.
4. No incluyas "resultados_detectados".
5. No agregues explicaciones ni markdown.

Formato exacto:
{"hba1c":number|null,"glucosa_ayuno":number|null,"insulina":number|null,"trigliceridos":number|null,"hdl":number|null,"ldl":number|null,"alt":number|null,"ast":number|null,"tsh":number|null,"pcr_us":number|null,"creatinina":number|null,"acido_urico":number|null}
${sourceText ? `\n\nTEXTO EXTRAIDO DEL PDF:\n${sourceText}` : ""}`;
  }

  return `You are a medical assistant expert in laboratory interpretation. Extract ONLY these standard fields from the document: hba1c, glucosa_ayuno, insulina, trigliceridos, hdl, ldl, alt, ast, tsh, pcr_us, creatinina, acido_urico.

Rules:
1. Return only valid JSON.
2. Use a number when the exact result is present.
3. Use null when the test is not present.
4. Do not include "resultados_detectados".
5. Do not add explanations or markdown.

Exact format:
{"hba1c":number|null,"glucosa_ayuno":number|null,"insulina":number|null,"trigliceridos":number|null,"hdl":number|null,"ldl":number|null,"alt":number|null,"ast":number|null,"tsh":number|null,"pcr_us":number|null,"creatinina":number|null,"acido_urico":number|null}
${sourceText ? `\n\nTEXT EXTRACTED FROM PDF:\n${sourceText}` : ""}`;
}

function buildDetectedLabPrompt(locale: 'es' | 'en', sourceText: string, knownValues: StandardLabValues) {
  if (locale === 'es') {
    return `Analiza el texto del examen y devuelve SOLO JSON con "resultados_detectados".

Objetivo:
- Prioriza resultados adicionales que no están en los 12 campos principales.
- Máximo 30 resultados para no truncar la respuesta.

Valores estándar ya detectados:
${JSON.stringify(knownValues)}

Formato exacto:
{"resultados_detectados":[{"key":"ferritina","label":"Ferritina","value":58,"unit":"ng/mL"}]}

Reglas:
1. Cada item debe tener key, label, value y unit opcional.
2. key debe ir en snake_case.
3. value puede ser número o texto corto.
4. No agregues explicaciones ni markdown.

TEXTO EXTRAIDO DEL PDF:
${sourceText}`;
  }

  return `Analyze the lab text and return ONLY JSON with "resultados_detectados".

Goal:
- Prioritize additional results that are not part of the 12 main fields.
- Maximum 30 results to avoid truncation.

Standard values already detected:
${JSON.stringify(knownValues)}

Exact format:
{"resultados_detectados":[{"key":"ferritin","label":"Ferritin","value":58,"unit":"ng/mL"}]}

Rules:
1. Each item must include key, label, value and optional unit.
2. key must be snake_case.
3. value may be numeric or short text.
4. Do not add explanations or markdown.

TEXT EXTRACTED FROM PDF:
${sourceText}`;
}

function recoverJsonObject(clean: string): Record<string, unknown> | null {
  try {
    return parsePossiblyStringifiedJson(clean) as Record<string, unknown>;
  } catch (parseError) {
    console.warn('[extractLabValuesFromImage] JSON parse failed, attempting recovery:', parseError);

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

      if ((char === '}' || char === ']') && braceCount === 0 && bracketCount === 0) {
        bestIndex = i;
      }
    }

    if (bestIndex <= 0) {
      return null;
    }

    try {
      return parsePossiblyStringifiedJson(clean.substring(0, bestIndex + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
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
  if (ctx.ultima_glucosa) {
    labs.push(t(
      `Última glucosa registrada: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) el ${ctx.ultima_glucosa.fecha}`,
      `Last recorded glucose: ${ctx.ultima_glucosa.valor} mg/dL (${ctx.ultima_glucosa.tipo}) on ${ctx.ultima_glucosa.fecha}`
    ));
  }
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
    let parsedJson: Record<string, unknown>;
    try {
      parsedJson = JSON.parse(clean);
    } catch {
      // Recover from truncated JSON responses
      console.error('[estimateMealFromImage] JSON.parse failed. Raw AI response:', clean);
      
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
        
        if ((char === '}' || char === ']') && braceCount === 0 && bracketCount === 0) {
          bestIndex = i;
        }
      }
      
      if (bestIndex > 0) {
        const truncated = clean.substring(0, bestIndex + 1);
        try {
          parsedJson = JSON.parse(truncated);
        } catch {
          return null;
        }
      } else {
        return null;
      }
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
      (l.insulina != null ? `, Insulina ${l.insulina} µU/mL` : '') +
      (l.alt != null ? `, ALT ${l.alt} U/L` : '') +
      (l.ast != null ? `, AST ${l.ast} U/L` : '') +
      (l.tsh != null ? `, TSH ${l.tsh} µIU/mL` : '') +
      (l.creatinina != null ? `, Creatinina ${l.creatinina} mg/dL` : '') +
      (l.acido_urico != null ? `, Ácido úrico ${l.acido_urico} mg/dL` : '') +
      (l.pcr_us != null ? `, PCR-us ${l.pcr_us} mg/L` : '')
    ).join('. ') + `. Prioriza recomendaciones según estos valores reales del paciente. ` : '';

  const prompt =
    params.locale === 'es'
      ? `Actúa como asistente clínico educativo con enfoque metabólico. ${labContextBlock} Analiza este informe JSON de la última semana: ${JSON.stringify(params.data)}. Usa además este marco de producto para recomendaciones de productos/suplementos: ${THERMORUSH_CONTEXT.es}. ${getPromoProductGuidance('es')} 
      
REGLAS CRÍTICAS DE EVOLUCIÓN:
1) Analiza el objeto "evolution" en el JSON. Compara "peso_inicial" vs "peso_actual", "cintura_inicial" vs "cintura_actual", "sueno_inicial" vs "sueno_actual", "hba1c_inicial" vs "hba1c_actual" y "glucosa_inicial" vs "glucosa_actual".
2) En el campo "summary" y "patientMessage", celebra logros específicos basados en estas comparaciones. Ejemplo: "¡Increíble! Has bajado 5kg desde que iniciaste" o "Tu cintura se ha reducido en 4cm, lo cual es excelente para tu salud metabólica".
3) Conecta estos avances con el producto seleccionado ("producto_permitido"). Atribuye las mejoras en energía, control de peso o glucosa al uso constante del producto y buenos hábitos.
4) Si el sueño mejoró (ej. de 5 a 7 horas), menciónalo como un pilar del éxito metabólico gracias al soporte neuro-metabólico.
5) Si la glucosa bajó respecto al inicio, destaca esta protección contra picos.
6) Si no hay datos suficientes de mejora (ej. son iguales), anima al paciente indicando que la constancia con el producto y la alimentación traerán esos cambios pronto.
7) Tono: motivador, profesional, humano y celebratorio de pequeños y grandes cambios.

OTRAS REGLAS:
- Si el JSON incluye laboratorios con "resultados_detectados", usa también esos analitos extra para afinar tus recomendaciones clínicas.
- Si glucosa_real_registrada es false, usa glucosa_estimada_por_comidas y aclara que es estimación.
- En patientMessage, menciona comidas inadecuadas específicas si existen y da alternativas.
- Analiza el campo "glucosa_con_relacion_comida" si existe y tiene datos. Este array contiene lecturas de glucosa que fueron tomadas DESPUÉS de comer ciertos alimentos (relación glucosa-comida). Si hay glucosa elevada después de una comida con alto carbohidratos o clasificación inadecuada, menciona esta conexión específica y sugiere alternativas. Este es el mecanismo de aprendizaje para identificar qué alimentos afectan más la glucosa del paciente.
- Genera un evolutionMessage corto (máximo 2-3 frases) comparando el inicio con lo actual de forma motivadora. Atribuye el éxito al producto especificado.
- Si recomiendas ThermoRush, explica dosis (antes de desayuno y almuerzo) y objetivo.
- Devuelve SOLO JSON válido: {"summary":"...","centralProblems":["..."],"priorityPlan":["..."],"nutritionFocus":["..."],"lifestyleFocus":["..."],"recommendedLabs":["..."],"productsGuidance":["..."],"expectedProgress":["..."],"patientMessage":"...","evolutionMessage":"...","suggestions":["..."]}. Máximo 6 suggestions.`
      : `Act as an educational metabolic-care assistant. ${labContextBlock ? labContextBlock.replace('DATOS DE LABORATORIO', 'LAB DATA').replace('El paciente tiene estudios recientes', 'The patient has recent studies').replace('Prioriza recomendaciones según estos valores reales del paciente', 'Prioritize recommendations based on these actual values') : ''} Analyze this weekly JSON report: ${JSON.stringify(params.data)}. Also use this product guidance framework for supplements/products recommendations: ${THERMORUSH_CONTEXT.en}. ${getPromoProductGuidance('en')}

CRITICAL EVOLUTION RULES:
1) Analyze the "evolution" object in the JSON. Compare "peso_inicial" vs "peso_actual", "cintura_inicial" vs "cintura_actual", "sueno_inicial" vs "sueno_actual", "hba1c_inicial" vs "hba1c_actual" and "glucosa_inicial" vs "glucosa_actual".
2) In the "summary" and "patientMessage" fields, celebrate specific achievements based on these comparisons. Example: "Amazing! You've lost 5kg since you started" or "Your waist has reduced by 4cm, which is excellent for your metabolic health."
3) Connect these improvements to the selected product ("producto_permitido"). Attribute gains in energy, weight control, or glucose to consistent product use and good habits.
4) If sleep improved (e.g., from 5 to 7 hours), mention it as a pillar of metabolic success thanks to neuro-metabolic support.
5) If glucose dropped compared to the start, highlight this protection against spikes.
6) If there is not enough data for improvement (e.g., values are equal), encourage the patient stating that consistency with the product and nutrition will bring changes soon.
7) Tone: motivating, professional, human, and celebratory of small and large changes.

OTHER RULES:
- If the JSON includes labs with "resultados_detectados", use those extra analytes too to refine your clinical recommendations.
- Never mention restricted products.
- If glucosa_real_registrada is false, use glucosa_estimada_por_comidas and clarify it is an estimate.
- In patientMessage, mention specific inadequate meals if they exist and provide alternatives.
- Analyze the field "glucosa_con_relacion_comida" if it exists and has data. This array contains glucose readings that were taken AFTER eating certain foods (glucose-meal relationship). If there is elevated glucose after a meal with high carbohydrates or inadequate classification, mention this specific connection and suggest alternatives. This is the learning mechanism to identify which foods affect the patient's glucose the most.
- Generate a short evolutionMessage (max 2-3 sentences) comparing start vs current in a motivating way. Attribute success to the specified product.
- If you mention ThermoRush, include timing (before breakfast and lunch) and rationale.
- Return ONLY valid JSON: {"summary":"...","centralProblems":["..."],"priorityPlan":["..."],"nutritionFocus":["..."],"lifestyleFocus":["..."],"recommendedLabs":["..."],"productsGuidance":["..."],"expectedProgress":["..."],"patientMessage":"...","evolutionMessage":"...","suggestions":["..."]}. Max 6 suggestions.`;

  try {
    const response = await generateGeminiText({ prompt, temperature: 0.2, maxOutputTokens: 1536 });
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
  const requestedPdf = isPdfUrl(params.imageUrl);
  const pdfText = await extractPdfTextFromUrl(params.imageUrl);
  const isPdfDocument = requestedPdf || pdfText != null;
  const standardValuesFromPdf = pdfText ? extractStandardLabValuesFromText(pdfText) : {};

  if (requestedPdf && !pdfText) {
    console.error("[extractLabValuesFromImage] PDF detected but text extraction failed", {
      imageUrl: params.imageUrl,
    });
    return null;
  }

  try {
    const standardPrompt = buildStandardLabPrompt(params.locale, pdfText ?? undefined);
    const standardResponse = await generateGeminiText({
      prompt: standardPrompt,
      imageUrl: isPdfDocument ? undefined : params.imageUrl,
      temperature: 0.1,
      maxOutputTokens: 500,
    });
    const standardClean = standardResponse.replaceAll('```json', '').replaceAll('```', '').trim();
    console.log('[extractLabValuesFromImage] Standard AI response:', standardClean);

    const standardJson = recoverJsonObject(standardClean);
    const standardParse = labVisionSchema.omit({ resultados_detectados: true }).safeParse(standardJson ?? {});
    const aiStandardValues = sanitizeStandardLabValues(standardParse.success ? standardParse.data : {});
    const pdfFallbackValues = sanitizeStandardLabValues(standardValuesFromPdf);
    const mergedStandardValues = mergeStandardLabValues(aiStandardValues, pdfFallbackValues);

    let detectedResults = buildStandardDetectedResults(mergedStandardValues, standardLabLabels);

    if (pdfText) {
      try {
        const detectedPrompt = buildDetectedLabPrompt(params.locale, pdfText, mergedStandardValues);
        const detectedResponse = await generateGeminiText({
          prompt: detectedPrompt,
          temperature: 0.1,
          maxOutputTokens: 1400,
        });
        const detectedClean = detectedResponse.replaceAll('```json', '').replaceAll('```', '').trim();
        console.log('[extractLabValuesFromImage] Detected-fields AI response:', detectedClean);
        const detectedJson = recoverJsonObject(detectedClean);
        const detectedParse = detectedLabResultsSchema.safeParse(detectedJson?.resultados_detectados);
        if (detectedParse.success && detectedParse.data.length > 0) {
          detectedResults = detectedParse.data;
        }
      } catch (detectedError) {
        console.warn('[extractLabValuesFromImage] Optional detected-fields pass failed', detectedError);
      }
    }

    if (!hasAnyStandardLabValue(mergedStandardValues) && detectedResults.length === 0) {
      return null;
    }

    return labVisionSchema.parse({
      ...mergedStandardValues,
      resultados_detectados: detectedResults,
    });
  } catch (error) {
    if (hasAnyStandardLabValue(standardValuesFromPdf)) {
      console.warn("[extractLabValuesFromImage] Using PDF text fallback after AI error", error);
      return buildLabFallbackResult(standardValuesFromPdf);
    }
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
