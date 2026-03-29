import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createSupabaseServerClient(options?: { useServiceRole?: boolean }) {
  const authKey = options?.useServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey
    : supabaseAnonKey;
  return createClient(supabaseUrl, authKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
