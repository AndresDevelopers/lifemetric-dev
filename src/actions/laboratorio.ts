"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPacienteId } from "@/actions/data";
import { extractLabValuesFromImage } from "@/lib/ai/gemini";
import { checkRateLimit } from "@/lib/redis";

const autofillSchema = z.object({
  imageUrl: z.string().url("Debe ser una URL válida"),
  locale: z.enum(["es", "en"]).default("es"),
});

const labResultSchema = z.object({
  hba1c: z.number().min(0).max(20).optional(),
  glucosa_ayuno: z.number().min(0).max(1000).optional(),
  trigliceridos: z.number().min(0).max(2000).optional(),
  hdl: z.number().min(0).max(300).optional(),
  ldl: z.number().min(0).max(1000).optional(),
  insulina: z.number().min(0).max(500).optional(),
  alt: z.number().min(0).max(500).optional(),
  ast: z.number().min(0).max(500).optional(),
  tsh: z.number().min(0).max(20).optional(),
  creatinina: z.number().min(0).max(20).optional(),
  acido_urico: z.number().min(0).max(20).optional(),
  pcr_us: z.number().min(0).max(100).optional(),
});

const saveLabSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha_estudio: z.string().min(10),
  hba1c: z.number().min(0).max(20).optional(),
  glucosa_ayuno: z.number().min(0).max(1000).optional(),
  trigliceridos: z.number().min(0).max(2000).optional(),
  hdl: z.number().min(0).max(300).optional(),
  ldl: z.number().min(0).max(1000).optional(),
  insulina: z.number().min(0).max(500).optional(),
  alt: z.number().min(0).max(500).optional(),
  ast: z.number().min(0).max(500).optional(),
  tsh: z.number().min(0).max(20).optional(),
  creatinina: z.number().min(0).max(20).optional(),
  acido_urico: z.number().min(0).max(20).optional(),
  pcr_us: z.number().min(0).max(100).optional(),
  archivo_url: z.string().optional(),
});

export async function autofillLaboratorioFromDocumentAction(rawData: unknown) {
  const input = autofillSchema.parse(rawData);

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.GEMINI_API_KEY) {
    return { success: false, error: "AI Gateway no está configurado." } as const;
  }

  const pacienteId = await getSessionPacienteId();
  if (!pacienteId) {
    return { success: false, error: "No autorizado" } as const;
  }

  const isAllowed = await checkRateLimit(`autofill_lab:${pacienteId}`);
  if (!isAllowed) {
    return { success: false, error: "Demasiadas consultas de AI. Intente más tarde." } as const;
  }

  try {
    // Use the existing extractLabValuesFromImage function from gemini.ts
    // This function already handles the URL fetching and image processing correctly
    const result = await extractLabValuesFromImage({
      imageUrl: input.imageUrl,
      locale: input.locale,
    });

    if (!result) {
      return { success: false, error: "No se pudieron extraer datos del laboratorio. Verifique que el documento sea legible." } as const;
    }

    // Filter to only include fields that are defined (not null/undefined)
    const validatedResult: z.infer<typeof labResultSchema> = {};
    
    if (result.hba1c != null) validatedResult.hba1c = result.hba1c;
    if (result.glucosa_ayuno != null) validatedResult.glucosa_ayuno = result.glucosa_ayuno;
    if (result.trigliceridos != null) validatedResult.trigliceridos = result.trigliceridos;
    if (result.hdl != null) validatedResult.hdl = result.hdl;
    if (result.ldl != null) validatedResult.ldl = result.ldl;
    if (result.insulina != null) validatedResult.insulina = result.insulina;
    if (result.alt != null) validatedResult.alt = result.alt;
    if (result.ast != null) validatedResult.ast = result.ast;
    if (result.tsh != null) validatedResult.tsh = result.tsh;
    if (result.creatinina != null) validatedResult.creatinina = result.creatinina;
    if (result.acido_urico != null) validatedResult.acido_urico = result.acido_urico;
    if (result.pcr_us != null) validatedResult.pcr_us = result.pcr_us;

    return { success: true, data: validatedResult } as const;
  } catch (error) {
    console.error("[autofillLaboratorioFromDocumentAction] Error:", error);
    return { success: false, error: "Error al procesar el documento. Intente de nuevo." } as const;
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
      insulina: data.insulina,
      alt: data.alt,
      ast: data.ast,
      tsh: data.tsh,
      creatinina: data.creatinina,
      acido_urico: data.acido_urico,
      pcr_us: data.pcr_us,
      archivo_url: data.archivo_url,
    },
  });

  return { success: true, laboratorio_id: created.laboratorio_id } as const;
}
