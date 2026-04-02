export const RUNTIME_COUNTRY_COOKIE_NAME = 'lifemetric_country';
export const RUNTIME_CITY_COOKIE_NAME = 'lifemetric_city';
export const RUNTIME_TIMEZONE_COOKIE_NAME = 'lifemetric_timezone';

export type RuntimeGeo = {
  country: string | null;
  city: string | null;
  timeZone: string;
};

type RuntimeGeoInput = {
  headerCountry?: string | null;
  cookieCountry?: string | null;
  headerCity?: string | null;
  cookieCity?: string | null;
  headerTimeZone?: string | null;
  cookieTimeZone?: string | null;
  clientTimeZone?: string | null;
};

function cleanValue(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isValidTimeZone(timeZone?: string | null): timeZone is string {
  if (!timeZone) {
    return false;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveRuntimeGeo(input: RuntimeGeoInput): RuntimeGeo {
  const country = cleanValue(input.headerCountry) ?? cleanValue(input.cookieCountry);
  const city = cleanValue(input.headerCity) ?? cleanValue(input.cookieCity);

  const detectedTimeZone =
    cleanValue(input.clientTimeZone) ??
    cleanValue(input.headerTimeZone) ??
    cleanValue(input.cookieTimeZone);

  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return {
    country,
    city,
    timeZone: isValidTimeZone(detectedTimeZone) ? detectedTimeZone : fallback,
  };
}

export function formatRuntimeDateTime(params: {
  date?: Date;
  locale: 'es' | 'en';
  timeZone: string;
}): string {
  const date = params.date ?? new Date();

  return new Intl.DateTimeFormat(params.locale === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: params.timeZone,
  }).format(date);
}

export function formatRuntimeDateKey(timeZone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
