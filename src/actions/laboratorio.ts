"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPacienteId } from "@/actions/data";
import { extractLabValuesFromImage } from "@/lib/ai/gemini";
import {
  optionalLabMeasurementShape,
  optionalLabUploadShape,
} from "@/lib/laboratorioSchema";
import { checkRateLimit } from "@/lib/redis";
import {
  detectedLabResultsSchema,
  inferStandardLabValuesFromDetectedResults,
} from "@/lib/labResults";

const autofillSchema = z.object({
  imageUrl: z.string().url("Debe ser una URL válida"),
  locale: z.enum(["es", "en"]).default("es"),
});

const labResultSchema = z.object({
  ...optionalLabMeasurementShape,
  resultados_detectados: detectedLabResultsSchema.optional(),
});

type LabResult = z.infer<typeof labResultSchema>;

const saveLabSchema = z.object({
  paciente_id: z.string().uuid(),
  fecha_estudio: z.string().min(10),
  ...optionalLabMeasurementShape,
  ...optionalLabUploadShape,
});

export async function autofillLaboratorioFromDocumentAction(rawData: unknown) {
  const inputParsed = autofillSchema.safeParse(rawData);
  if (!inputParsed.success) {
    return { success: false, error: "Documento inválido para autocompletar." } as const;
  }
  const input = inputParsed.data;

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
    let result: Awaited<ReturnType<typeof extractLabValuesFromImage>> = null;
    try {
      result = await extractLabValuesFromImage({
        imageUrl: input.imageUrl,
        locale: input.locale,
      });
    } catch (error) {
      console.error("[autofillLaboratorioFromDocumentAction] extractLabValuesFromImage threw:", error);
      result = null;
    }

    if (!result) {
      return { success: false, error: "No se pudieron extraer datos del laboratorio. Verifique que el documento sea legible." } as const;
    }

    const inferredValues = inferStandardLabValuesFromDetectedResults(result.resultados_detectados);

    // Filter to only include fields that are defined (not null/undefined)
    const validatedResult: LabResult = {};
    
    const mergedStandardValues = {
      hba1c: result.hba1c ?? inferredValues.hba1c,
      glucosa_ayuno: result.glucosa_ayuno ?? inferredValues.glucosa_ayuno,
      trigliceridos: result.trigliceridos ?? inferredValues.trigliceridos,
      hdl: result.hdl ?? inferredValues.hdl,
      ldl: result.ldl ?? inferredValues.ldl,
      insulina: result.insulina ?? inferredValues.insulina,
      alt: result.alt ?? inferredValues.alt,
      ast: result.ast ?? inferredValues.ast,
      tsh: result.tsh ?? inferredValues.tsh,
      creatinina: result.creatinina ?? inferredValues.creatinina,
      acido_urico: result.acido_urico ?? inferredValues.acido_urico,
      pcr_us: result.pcr_us ?? inferredValues.pcr_us,
    } satisfies Record<string, number | null | undefined>;

    if (mergedStandardValues.hba1c != null) validatedResult.hba1c = mergedStandardValues.hba1c;
    if (mergedStandardValues.glucosa_ayuno != null) validatedResult.glucosa_ayuno = mergedStandardValues.glucosa_ayuno;
    if (mergedStandardValues.trigliceridos != null) validatedResult.trigliceridos = mergedStandardValues.trigliceridos;
    if (mergedStandardValues.hdl != null) validatedResult.hdl = mergedStandardValues.hdl;
    if (mergedStandardValues.ldl != null) validatedResult.ldl = mergedStandardValues.ldl;
    if (mergedStandardValues.insulina != null) validatedResult.insulina = mergedStandardValues.insulina;
    if (mergedStandardValues.alt != null) validatedResult.alt = mergedStandardValues.alt;
    if (mergedStandardValues.ast != null) validatedResult.ast = mergedStandardValues.ast;
    if (mergedStandardValues.tsh != null) validatedResult.tsh = mergedStandardValues.tsh;
    if (mergedStandardValues.creatinina != null) validatedResult.creatinina = mergedStandardValues.creatinina;
    if (mergedStandardValues.acido_urico != null) validatedResult.acido_urico = mergedStandardValues.acido_urico;
    if (mergedStandardValues.pcr_us != null) validatedResult.pcr_us = mergedStandardValues.pcr_us;
    if (result.resultados_detectados?.length) {
      const safeDetectedResults = detectedLabResultsSchema.safeParse(result.resultados_detectados);
      if (safeDetectedResults.success) {
        validatedResult.resultados_detectados = safeDetectedResults.data;
      } else {
        console.warn("[autofillLaboratorioFromDocumentAction] Discarding invalid detected lab results");
      }
    }

    const safeValidatedResult = labResultSchema.safeParse(validatedResult);
    if (safeValidatedResult.success) {
      return { success: true, data: safeValidatedResult.data } as const;
    }

    console.warn("[autofillLaboratorioFromDocumentAction] Falling back to standard lab fields only", safeValidatedResult.error.flatten());

    const standardOnlyResult: LabResult = {};
    if (mergedStandardValues.hba1c != null) standardOnlyResult.hba1c = mergedStandardValues.hba1c;
    if (mergedStandardValues.glucosa_ayuno != null) standardOnlyResult.glucosa_ayuno = mergedStandardValues.glucosa_ayuno;
    if (mergedStandardValues.trigliceridos != null) standardOnlyResult.trigliceridos = mergedStandardValues.trigliceridos;
    if (mergedStandardValues.hdl != null) standardOnlyResult.hdl = mergedStandardValues.hdl;
    if (mergedStandardValues.ldl != null) standardOnlyResult.ldl = mergedStandardValues.ldl;
    if (mergedStandardValues.insulina != null) standardOnlyResult.insulina = mergedStandardValues.insulina;
    if (mergedStandardValues.alt != null) standardOnlyResult.alt = mergedStandardValues.alt;
    if (mergedStandardValues.ast != null) standardOnlyResult.ast = mergedStandardValues.ast;
    if (mergedStandardValues.tsh != null) standardOnlyResult.tsh = mergedStandardValues.tsh;
    if (mergedStandardValues.creatinina != null) standardOnlyResult.creatinina = mergedStandardValues.creatinina;
    if (mergedStandardValues.acido_urico != null) standardOnlyResult.acido_urico = mergedStandardValues.acido_urico;
    if (mergedStandardValues.pcr_us != null) standardOnlyResult.pcr_us = mergedStandardValues.pcr_us;

    const standardOnlyParsed = labResultSchema.safeParse(standardOnlyResult);
    if (standardOnlyParsed.success) {
      return { success: true, data: standardOnlyParsed.data } as const;
    }

    console.error("[autofillLaboratorioFromDocumentAction] Standard-only fallback also failed", standardOnlyParsed.error.flatten());
    return { success: false, error: "No se pudieron extraer datos del laboratorio. Verifique que el documento sea legible." } as const;
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
      resultados_detectados: data.resultados_detectados,
    },
  });

  return { success: true, laboratorio_id: created.laboratorio_id } as const;
}
