import { z } from "zod";
import { detectedLabResultsSchema } from "@/lib/labResults";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number" && Number.isNaN(value)) {
    return undefined;
  }

  return value;
}

function optionalLabNumber(min: number, max: number) {
  return z.preprocess(emptyToUndefined, z.number().min(min).max(max).optional());
}

export const optionalLabMeasurementShape = {
  hba1c: optionalLabNumber(0, 20),
  glucosa_ayuno: optionalLabNumber(0, 1000),
  trigliceridos: optionalLabNumber(0, 2000),
  hdl: optionalLabNumber(0, 300),
  ldl: optionalLabNumber(0, 1000),
  insulina: optionalLabNumber(0, 500),
  alt: optionalLabNumber(0, 500),
  ast: optionalLabNumber(0, 500),
  tsh: optionalLabNumber(0, 20),
  creatinina: optionalLabNumber(0, 20),
  acido_urico: optionalLabNumber(0, 20),
  pcr_us: optionalLabNumber(0, 100),
} as const;

export const optionalLabUploadShape = {
  archivo_url: z.preprocess(emptyToUndefined, z.string().optional()),
  resultados_detectados: z.preprocess(emptyToUndefined, detectedLabResultsSchema.optional()),
} as const;
