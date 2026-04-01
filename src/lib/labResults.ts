import { z } from "zod";

export const standardLabFieldConfig = {
  hba1c: { labelKey: "hba1c", unit: "%" },
  glucosa_ayuno: { labelKey: "fastingGlucose", unit: "mg/dL" },
  trigliceridos: { labelKey: "triglycerides", unit: "mg/dL" },
  hdl: { labelKey: "hdl", unit: "mg/dL" },
  ldl: { labelKey: "ldl", unit: "mg/dL" },
  insulina: { labelKey: "insulin", unit: "μU/mL" },
  alt: { labelKey: "alt", unit: "U/L" },
  ast: { labelKey: "ast", unit: "U/L" },
  tsh: { labelKey: "tsh", unit: "μIU/mL" },
  creatinina: { labelKey: "creatinine", unit: "mg/dL" },
  acido_urico: { labelKey: "uricAcid", unit: "mg/dL" },
  pcr_us: { labelKey: "pcr_us", unit: "mg/L" },
} as const;

export type StandardLabFieldKey = keyof typeof standardLabFieldConfig;

export const detectedLabResultSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  value: z.union([z.number(), z.string().trim().min(1).max(120)]),
  unit: z.string().trim().min(1).max(40).optional(),
});

export const detectedLabResultsSchema = z.array(detectedLabResultSchema).max(80);

export type DetectedLabResult = z.infer<typeof detectedLabResultSchema>;

type LabLabels = Record<string, string>;

export type StandardLabValues = Partial<Record<StandardLabFieldKey, number | null | undefined>>;

const standardLabFieldAliases: Record<StandardLabFieldKey, string[]> = {
  hba1c: ["hba1c", "hb_a1c", "hemoglobina_glicosilada", "hemoglobina_glucosilada", "glycated_hemoglobin"],
  glucosa_ayuno: ["glucosa_ayuno", "glucosa", "glucosa_en_ayuno", "fasting_glucose", "glucose_fasting"],
  trigliceridos: ["trigliceridos", "triglycerides", "tg"],
  hdl: ["hdl", "colesterol_hdl", "hdl_colesterol"],
  ldl: ["ldl", "colesterol_ldl", "ldl_colesterol"],
  insulina: ["insulina", "insulin"],
  alt: ["alt", "tgp", "alanina_aminotransferasa"],
  ast: ["ast", "tgo", "aspartato_aminotransferasa"],
  tsh: ["tsh", "thyroid_stimulating_hormone"],
  creatinina: ["creatinina", "creatinine"],
  acido_urico: ["acido_urico", "uric_acid", "acido_úrico"],
  pcr_us: ["pcr_us", "pcr-us", "pcrus", "hscrp", "hs_crp", "pcr_ultrasensible"],
};

const standardLabTextAliases: Record<StandardLabFieldKey, string[]> = {
  hba1c: [
    "hemoglobina glicosilada",
    "hemoglobina glucosilada",
    "hba1c",
    "hb a1c",
  ],
  glucosa_ayuno: [
    "glucosa, suero",
    "glucosa en ayuno",
    "glucosa ayuno",
    "glucosa",
  ],
  trigliceridos: ["trigliceridos, suero", "trigliceridos", "triglycerides"],
  hdl: [
    "lipoproteina de alta densidad (hdl)",
    "colesterol hdl",
    "hdl",
  ],
  ldl: [
    "lipoproteina de baja densidad (ldl)",
    "colesterol ldl",
    "ldl",
  ],
  insulina: ["insulina", "insulin"],
  alt: [
    "alaninoaminotransferasa (tgp)",
    "alanina aminotransferasa",
    "alt",
    "tgp",
  ],
  ast: [
    "aspartatoaminotransferasa (tgo)",
    "aspartato aminotransferasa",
    "ast",
    "tgo",
  ],
  tsh: ["tsh-sensitiva", "tsh", "thyroid stimulating hormone"],
  creatinina: ["creatinina, suero", "creatinina", "creatinine"],
  acido_urico: ["acido urico, suero", "acido urico", "uric acid"],
  pcr_us: [
    "proteina c reactiva ultrasensible",
    "proteina c reactiva",
    "pcr-us",
    "pcr us",
    "hs-crp",
  ],
};

const standardLabUnitHints: Partial<Record<StandardLabFieldKey, string[]>> = {
  hba1c: ["%"],
  glucosa_ayuno: ["mg/dl"],
  trigliceridos: ["mg/dl"],
  hdl: ["mg/dl"],
  ldl: ["mg/dl"],
  insulina: ["uiu/ml", "mu/ml", "miu/ml", "iu/ml"],
  alt: ["u/l"],
  ast: ["u/l"],
  tsh: ["mui/l", "miu/ml", "uiu/ml", "mul/l"],
  creatinina: ["mg/dl"],
  acido_urico: ["mg/dl"],
  pcr_us: ["mg/l"],
};

export function isStandardLabFieldKey(value: string): value is StandardLabFieldKey {
  return value in standardLabFieldConfig;
}

function normalizeLabKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeLabText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toNumberIfPossible(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveStandardFieldKey(result: DetectedLabResult): StandardLabFieldKey | null {
  const candidates = [result.key, result.label].map((item) => normalizeLabKey(item));

  for (const candidate of candidates) {
    if (isStandardLabFieldKey(candidate)) {
      return candidate;
    }

    const matched = (Object.keys(standardLabFieldAliases) as StandardLabFieldKey[]).find((key) =>
      standardLabFieldAliases[key].some((alias) => normalizeLabKey(alias) === candidate),
    );

    if (matched) {
      return matched;
    }
  }

  return null;
}

function formatDetectedValue(value: string | number, unit?: string) {
  return unit ? `${value} ${unit}` : String(value);
}

export function buildStandardDetectedResults(
  values: StandardLabValues,
  labLabels: LabLabels,
): DetectedLabResult[] {
  return (Object.keys(standardLabFieldConfig) as StandardLabFieldKey[])
    .flatMap((key) => {
      const value = values[key];
      if (value == null) {
        return [];
      }

      const config = standardLabFieldConfig[key];
      return [
        {
          key,
          label: labLabels[config.labelKey] ?? key,
          value,
          unit: config.unit,
        },
      ];
    });
}

export function normalizeDetectedResults(
  rawResults: unknown,
  labLabels: LabLabels,
): DetectedLabResult[] {
  const parsed = detectedLabResultsSchema.safeParse(rawResults);
  if (!parsed.success) {
    return [];
  }

  const seen = new Set<string>();

  return parsed.data.flatMap((item) => {
    const normalizedKey = item.key.trim().toLowerCase().replace(/\s+/g, "_");
    const standardConfig = isStandardLabFieldKey(normalizedKey)
      ? standardLabFieldConfig[normalizedKey]
      : null;

    const normalizedItem: DetectedLabResult = {
      key: normalizedKey,
      label: standardConfig ? (labLabels[standardConfig.labelKey] ?? item.label) : item.label,
      value: item.value,
      unit: item.unit || standardConfig?.unit,
    };

    const dedupeKey = `${normalizedItem.key}:${String(normalizedItem.value)}:${normalizedItem.unit ?? ""}`;
    if (seen.has(dedupeKey)) {
      return [];
    }

    seen.add(dedupeKey);
    return [normalizedItem];
  });
}

export function buildDetectedResultsFromStoredLab(
  params: {
    standardValues: StandardLabValues;
    detectedResults?: unknown;
  },
  labLabels: LabLabels,
): DetectedLabResult[] {
  const standardDetected = buildStandardDetectedResults(params.standardValues, labLabels);
  const detected = normalizeDetectedResults(params.detectedResults, labLabels);
  if (detected.length === 0) {
    return standardDetected;
  }

  const combinedByKey = new Map<string, DetectedLabResult>();

  for (const item of standardDetected) {
    combinedByKey.set(item.key, item);
  }

  for (const item of detected) {
    combinedByKey.set(item.key, item);
  }

  return Array.from(combinedByKey.values());
}

export function buildLabChipsFromDetectedResults(results: DetectedLabResult[]) {
  return results.map((item) => ({
    label: item.label,
    value: formatDetectedValue(item.value, item.unit),
  }));
}

export function inferStandardLabValuesFromDetectedResults(rawResults: unknown): StandardLabValues {
  const parsed = detectedLabResultsSchema.safeParse(rawResults);
  if (!parsed.success) {
    return {};
  }

  const inferred: StandardLabValues = {};

  for (const result of parsed.data) {
    const matchedKey = resolveStandardFieldKey(result);
    if (!matchedKey || inferred[matchedKey] != null) {
      continue;
    }

    const numericValue = toNumberIfPossible(result.value);
    if (numericValue == null) {
      continue;
    }

    inferred[matchedKey] = numericValue;
  }

  return inferred;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseNumericCandidate(rawValue: string): number | null {
  const parsed = Number(rawValue.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumericValueNearAlias(
  normalizedText: string,
  aliases: string[],
  unitHints?: string[],
): number | null {
  for (const alias of aliases) {
    const aliasIndex = normalizedText.indexOf(normalizeLabText(alias));
    if (aliasIndex < 0) {
      continue;
    }

    const windowText = normalizedText.slice(aliasIndex, aliasIndex + 220);
    const unitPattern =
      unitHints && unitHints.length > 0
        ? `\\s*(?:${unitHints.map((unit) => escapeRegExp(unit)).join("|")})\\b`
        : "";
    const match = windowText.match(new RegExp(`(-?\\d+(?:[.,]\\d+)?)${unitPattern}`, "i"));

    if (!match) {
      continue;
    }

    const numericValue = parseNumericCandidate(match[1]);
    if (numericValue != null) {
      return numericValue;
    }
  }

  return null;
}

export function extractStandardLabValuesFromText(rawText: string): StandardLabValues {
  const normalizedText = normalizeLabText(rawText);
  const extracted: StandardLabValues = {};

  for (const key of Object.keys(standardLabTextAliases) as StandardLabFieldKey[]) {
    const value = extractNumericValueNearAlias(
      normalizedText,
      standardLabTextAliases[key],
      standardLabUnitHints[key],
    );

    if (value != null) {
      extracted[key] = value;
    }
  }

  return extracted;
}
