export const MEAL_IMAGE_RETENTION_DAYS = 365;
export const MEDICATION_IMAGE_RETENTION_DAYS = 180;
export const LAB_IMAGE_RETENTION_DAYS = 240;

function getSupabaseStorageBaseUrl(): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/`;
}

export function getStoragePathFromPublicUrl(url: string, bucket: string): string | null {
  const baseUrl = getSupabaseStorageBaseUrl();
  if (!baseUrl) return null;

  const normalizedBase = `${baseUrl}${bucket}/`;
  if (!url.startsWith(normalizedBase)) return null;
  return url.slice(normalizedBase.length);
}
