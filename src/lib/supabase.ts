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

export async function findSupabaseAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabaseAdmin = createSupabaseServerClient({ useServiceRole: true });

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      throw error;
    }

    const authUser = data.users.find((item) => item.email?.trim().toLowerCase() === normalizedEmail);
    if (authUser) {
      return authUser;
    }

    if (data.users.length < 1000) {
      break;
    }
  }

  return null;
}
