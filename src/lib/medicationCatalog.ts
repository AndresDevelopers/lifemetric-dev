type MedicationDetails = {
  aliases: string[];
  descriptionEs: string;
  descriptionEn: string;
};

const MEDICATION_CATALOG: MedicationDetails[] = [
  {
    aliases: ["metformina", "metformin"],
    descriptionEs: "Ayuda a controlar la glucosa en sangre y mejora la sensibilidad a la insulina en diabetes tipo 2.",
    descriptionEn: "Helps control blood glucose and improves insulin sensitivity in type 2 diabetes.",
  },
  {
    aliases: ["insulina glargina", "glargine", "lantus"],
    descriptionEs: "Insulina basal de acción prolongada para mantener glucosa estable entre comidas y durante la noche.",
    descriptionEn: "Long-acting basal insulin used to keep glucose steady between meals and overnight.",
  },
  {
    aliases: ["insulina lispro", "lispro", "humalog"],
    descriptionEs: "Insulina de acción rápida para corregir elevaciones de glucosa después de comer.",
    descriptionEn: "Rapid-acting insulin used to control post-meal glucose elevations.",
  },
  {
    aliases: ["losartan", "losartán"],
    descriptionEs: "Ayuda a controlar la presión arterial y protege el riñón, especialmente en personas con diabetes.",
    descriptionEn: "Helps control blood pressure and protects the kidneys, especially in people with diabetes.",
  },
  {
    aliases: ["atorvastatina", "atorvastatin"],
    descriptionEs: "Reduce colesterol LDL y apoya la prevención de riesgo cardiovascular.",
    descriptionEn: "Lowers LDL cholesterol and supports cardiovascular risk prevention.",
  },
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function getMedicationCatalogDescription(name: string, locale: "es" | "en"): string | null {
  const normalized = normalizeText(name);
  if (!normalized) return null;

  const match = MEDICATION_CATALOG.find((item) =>
    item.aliases.some((alias) => normalized.includes(normalizeText(alias))),
  );

  if (!match) return null;
  return locale === "es" ? match.descriptionEs : match.descriptionEn;
}
