export const BANNED_PROMO_PRODUCTS = [
  'Herbal Therapi',
  'Phyto Alcohol',
  'Phyto Cancer',
  'Phyto Cigarro',
  'Phyto Drogas',
  'Pain roll on',
  'Perfect Skin',
  'Sugar Beat',
] as const;

export const PROMO_FOCUS_PRODUCTS = [
  'Synergy',
  'Phyto Migraña',
  'Renewal Therapi',
  'Essential Therapi',
  'Metabolic Therapi',
  'Thermorush',
  'Bio Therapi',
  'Phyto Artritis',
  'Phyto Circulacion',
  'Phyto Detox',
  'Phyto Diabetes',
  'Phyto Digestivo',
  'Phyto Hemorroides',
  'Phyto Hormonal',
  'Phyto Infeccion',
  'Phyto Inmune',
  'Phyto inflamacion',
  'Phyto Riñon',
  'Phyto Dolor',
  'Phyto Respiratorio',
  'Phyto Dormir',
  'Phyto Estrés',
  'Neuro Boot',
  'PM Night',
  'Vitamix',
  'Promt',
  'Inmune valance',
  'Pain crema',
  'Anxiolityc',
  'Self Regulador',
] as const;

export const REGISTER_DIAGNOSIS_OPTIONS = {
  es: [
    'Control metabólico',
    'Problemas de sueño',
    'Estrés o ansiedad',
    'Dolor o inflamación',
    'Salud digestiva',
    'Salud hormonal',
    'Salud inmune y respiratoria',
    'Salud circulatoria',
    'Salud renal y detox',
    'Migraña',
    'Artritis',
  ],
  en: [
    'Metabolic control',
    'Sleep issues',
    'Stress or anxiety',
    'Pain or inflammation',
    'Digestive health',
    'Hormonal health',
    'Immune and respiratory health',
    'Circulatory health',
    'Kidney and detox health',
    'Migraine',
    'Arthritis',
  ],
} as const;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const BANNED_NORMALIZED = BANNED_PROMO_PRODUCTS.map(normalize);
const FOCUS_NORMALIZED = PROMO_FOCUS_PRODUCTS.map(normalize);

export function isBannedPromoProduct(value: string): boolean {
  const normalized = normalize(value);
  return BANNED_NORMALIZED.some((item) => normalized.includes(item));
}

export function isControlledPromoProduct(value: string): boolean {
  const normalized = normalize(value);
  return [...BANNED_NORMALIZED, ...FOCUS_NORMALIZED].some((item) => normalized.includes(item));
}

export function matchesSameProductName(a: string, b: string): boolean {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

export function getPromoProductGuidance(locale: 'es' | 'en'): string {
  const focus = PROMO_FOCUS_PRODUCTS.join(', ');
  const banned = BANNED_PROMO_PRODUCTS.join(', ');

  if (locale === 'es') {
    return `Productos permitidos para guía comercial educativa: ${focus}. Productos restringidos (NO mencionar ni recomendar): ${banned}. Si el paciente no usa medicación y tiene perfil compatible, puedes sugerir de forma prudente un producto permitido con disclaimer médico.`;
  }

  return `Allowed products for educational commercial guidance: ${focus}. Restricted products (DO NOT mention or recommend): ${banned}. If patient is not on medication and profile is compatible, you may carefully suggest an allowed product with medical disclaimer.`;
}
