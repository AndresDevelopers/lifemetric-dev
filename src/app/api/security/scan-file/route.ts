import { NextResponse } from "next/server";
import { z } from "zod";

const vtUploadSchema = z.object({
  data: z.object({
    id: z.string().min(1),
  }),
});

const vtAnalysisSchema = z.object({
  data: z.object({
    attributes: z.object({
      status: z.enum(["queued", "in-progress", "completed"]).optional(),
      stats: z.object({
        malicious: z.number().default(0),
        suspicious: z.number().default(0),
      }),
    }),
  }),
});

const ANALYSIS_POLL_ATTEMPTS = 4;
const ANALYSIS_POLL_INTERVAL_MS = 1200;
const VIRUSTOTAL_TIMEOUT_MS = 6000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toUserMessage = (locale: "es" | "en", key: "clean" | "blocked" | "fallback") => {
  const messages = {
    es: {
      clean: "Archivo verificado: sin amenazas detectadas. Continuando con la subida.",
      blocked: "Archivo bloqueado por seguridad: detectamos señales de riesgo.",
      fallback: "No pudimos completar la validación de seguridad en este momento. Continuamos con la subida para mantener disponibilidad.",
    },
    en: {
      clean: "File verified: no threats detected. Continuing upload.",
      blocked: "File blocked for safety: risk indicators were detected.",
      fallback: "We could not complete security validation right now. Continuing upload to preserve availability.",
    },
  };

  return messages[locale][key];
};

const normalizeLocale = (value: string | null): "es" | "en" => (value === "es" ? "es" : "en");

const withTimeout = async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIRUSTOTAL_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const locale = normalizeLocale(formData.get("locale")?.toString() ?? null);

  if (!(file instanceof File)) {
    return NextResponse.json({ allowed: false, mode: "error", message: "Missing file in request." }, { status: 400 });
  }

  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ allowed: true, mode: "skipped", message: toUserMessage(locale, "fallback") });
  }

  try {
    const uploadPayload = new FormData();
    uploadPayload.append("file", file, file.name);

    const uploadResponse = await withTimeout("https://www.virustotal.com/api/v3/files", {
      method: "POST",
      headers: { "x-apikey": apiKey },
      body: uploadPayload,
      cache: "no-store",
    });

    if (!uploadResponse.ok) {
      return NextResponse.json({ allowed: true, mode: "skipped", message: toUserMessage(locale, "fallback") });
    }

    const uploadParsed = vtUploadSchema.safeParse(await uploadResponse.json());
    if (!uploadParsed.success) {
      return NextResponse.json({ allowed: true, mode: "skipped", message: toUserMessage(locale, "fallback") });
    }

    const analysisId = uploadParsed.data.data.id;

    let isCompleted = false;
    let maliciousCount = 0;
    let suspiciousCount = 0;

    for (let attempt = 0; attempt < ANALYSIS_POLL_ATTEMPTS; attempt += 1) {
      const analysisResponse = await withTimeout(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        method: "GET",
        headers: { "x-apikey": apiKey },
        cache: "no-store",
      });

      if (!analysisResponse.ok) {
        continue;
      }

      const analysisParsed = vtAnalysisSchema.safeParse(await analysisResponse.json());
      if (!analysisParsed.success) {
        continue;
      }

      const attributes = analysisParsed.data.data.attributes;
      maliciousCount = attributes.stats.malicious;
      suspiciousCount = attributes.stats.suspicious;

      if (maliciousCount > 0 || suspiciousCount > 0) {
        isCompleted = true;
        break;
      }

      if (attributes.status === "completed") {
        isCompleted = true;
        break;
      }

      await wait(ANALYSIS_POLL_INTERVAL_MS);
    }

    if (!isCompleted) {
      return NextResponse.json({ allowed: true, mode: "skipped", message: toUserMessage(locale, "fallback") });
    }

    const isBlocked = maliciousCount > 0 || suspiciousCount > 0;
    return NextResponse.json({
      allowed: !isBlocked,
      mode: "scanned",
      message: toUserMessage(locale, isBlocked ? "blocked" : "clean"),
    });
  } catch {
    return NextResponse.json({ allowed: true, mode: "skipped", message: toUserMessage(locale, "fallback") });
  }
}
