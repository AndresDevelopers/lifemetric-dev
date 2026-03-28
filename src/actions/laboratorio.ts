"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPacienteId } from "@/actions/data";
import { generateGeminiText } from "@/lib/ai/gemini";

const autofillSchema = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().min(3),
  locale: z.enum(["es", "en"]).default("es"),
});

const labResultSchema = z.object({
  hba1c: z.number().min(0).max(20).optional(),
  glucosa_ayuno: z.number().min(0).max(1000).optional(),
  trigliceridos: z.number().min(0).max(2000).optional(),
  hdl: z.number().min(0).max(300).optional(),
  ldl: z.number().min(0).max(1000).optional(),
});

const saveLabSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha_estudio: z.string().min(10),
  hba1c: z.number().min(0).max(20).optional(),
  glucosa_ayuno: z.number().min(0).max(1000).optional(),
  trigliceridos: z.number().min(0).max(2000).optional(),
  hdl: z.number().min(0).max(300).optional(),
  ldl: z.number().min(0).max(1000).optional(),
  archivo_url: z.string().optional(),
});

export async function autofillLaboratorioFromDocumentAction(rawData: unknown) {
  const input = autofillSchema.parse(rawData);

  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "Gemini no está configurado." } as const;
  }

  const prompt =
    input.locale === "es"
      ? `Analiza este estudio de laboratorio médico (base64 omito por privacidad). Extrae SOLO estos campos si existen y devuelve SOLO JSON válido: {"hba1c": number, "glucosa_ayuno": number, "trigliceridos": number, "hdl": number, "ldl": number}. Si un valor no aparece, no lo incluyas.`
      : `Analyze this lab report and extract ONLY these fields, returning ONLY valid JSON: {"hba1c": number, "glucosa_ayuno": number, "trigliceridos": number, "hdl": number, "ldl": number}. Omit unknown fields.`;

  const response = await generateGeminiText({
    prompt: `${prompt}\nMimeType: ${input.mimeType}\nDocumentBase64:${input.fileBase64.slice(0, 12000)}`,
    temperature: 0.1,
    maxOutputTokens: 300,
  });

  try {
    const parsed = labResultSchema.parse(JSON.parse(response));
    return { success: true, data: parsed } as const;
  } catch {
    return { success: false, error: "No se pudo extraer datos del documento." } as const;
  }
}

export async function guardarLaboratorioAction(rawData: unknown) {
  const pacienteId = await getSessionPacienteId();
  if (!pacienteId) {
    return { success: false, error: "Sesión inválida." } as const;
  }

  const data = saveLabSchema.parse(rawData);
  if (data.paciente_id !== pacienteId) {
    return { success: false, error: "Paciente inválido." } as const;
  }

  const created = await prisma.laboratorio.create({
    data: {
      paciente_id: data.paciente_id,
      fecha_estudio: new Date(data.fecha_estudio),
      hba1c: data.hba1c,
      glucosa_ayuno: data.glucosa_ayuno,
      trigliceridos: data.trigliceridos,
      hdl: data.hdl,
      ldl: data.ldl,
      archivo_url: data.archivo_url,
    },
  });

  return { success: true, laboratorio_id: created.laboratorio_id } as const;
}
