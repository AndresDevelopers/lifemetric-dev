import { NextResponse } from 'next/server';
import { getSupabaseAuthPasswordMinLength } from '@/lib/auth/passwordPolicy.server';

export async function GET() {
  const minLength = await getSupabaseAuthPasswordMinLength();
  return NextResponse.json({ minLength });
}
