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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseApiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const accessToken =
    process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_ACCESS_TOKEN?.trim();
  const projectRef = parseSupabaseProjectRef();

  if (accessToken && projectRef) {
    try {
      const response = await fetch(`${SUPABASE_MANAGEMENT_API_BASE_URL}/projects/${projectRef}/config/auth`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const config = (await response.json()) as SupabaseAuthConfigResponse;
        if (typeof config.password_min_length === 'number' && Number.isFinite(config.password_min_length) && config.password_min_length >= 1) {
          return config.password_min_length;
        }
      }
    } catch {
      // Try Auth API fallback below.
    }
  }

  if (supabaseUrl && supabaseApiKey) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: {
          apikey: supabaseApiKey,
          Authorization: `Bearer ${supabaseApiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const config = (await response.json()) as SupabaseAuthConfigResponse;
        if (typeof config.password_min_length === 'number' && Number.isFinite(config.password_min_length) && config.password_min_length >= 1) {
          return config.password_min_length;
        }
      }
    } catch {
      return AUTH_PASSWORD_MIN_LENGTH;
    }
  }

  return AUTH_PASSWORD_MIN_LENGTH;
}
