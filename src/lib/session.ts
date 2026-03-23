import { cookies } from 'next/headers';

/**
 * Utility to sign and verify session tokens using native Web Crypto API.
 * This is compatible with both Node.js (Server Actions) and Edge Runtime (Middleware).
 */

const getSecretKey = async () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not defined in environment variables');
  }
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
};

export async function signSession(payload: string): Promise<string> {
  const key = await getSecretKey();
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureBase64 = btoa(String.fromCodePoint(...new Uint8Array(signature)));
  return `${payload}.${signatureBase64}`;
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const [payload, signatureBase64] = token.split('.');
    if (!payload || !signatureBase64) return null;

    const key = await getSecretKey();
    const encoder = new TextEncoder();
    const signature = Uint8Array.from(atob(signatureBase64), (c) => c.codePointAt(0) ?? 0);
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload));

    return isValid ? payload : null;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

export async function setSession(pacienteId: string) {
  const payload = JSON.stringify({ pacienteId, timestamp: Date.now() });
  const token = await signSession(payload);
  const cookieStore = await cookies();
  
  cookieStore.set('lifemetric_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400 * 7, // 7 days
    path: '/',
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('lifemetric_session');
}
