import 'server-only';

import { AUTH_PASSWORD_MIN_LENGTH } from '@/lib/auth/passwordPolicy';

type SupabaseAuthConfigResponse = {
  password_min_length?: number | null;
};

const SUPABASE_MANAGEMENT_API_BASE_URL = 'https://api.supabase.com/v1';

function parseSupabaseProjectRef(): string | null {
  const explicitProjectRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicitProjectRef) {
    return explicitProjectRef;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split('.')[0]?.trim();
    return projectRef || null;
  } catch {
    return null;
  }
}

export async function getSupabaseAuthPasswordMinLength(): Promise<number> {
  const accessToken =
    process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = parseSupabaseProjectRef();

  if (!accessToken || !projectRef) {
    return AUTH_PASSWORD_MIN_LENGTH;
  }

  try {
    const response = await fetch(`${SUPABASE_MANAGEMENT_API_BASE_URL}/projects/${projectRef}/config/auth`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return AUTH_PASSWORD_MIN_LENGTH;
    }

    const config = (await response.json()) as SupabaseAuthConfigResponse;
    if (typeof config.password_min_length === 'number' && Number.isFinite(config.password_min_length) && config.password_min_length >= 1) {
      return config.password_min_length;
    }
  } catch {
    return AUTH_PASSWORD_MIN_LENGTH;
  }

  return AUTH_PASSWORD_MIN_LENGTH;
}
