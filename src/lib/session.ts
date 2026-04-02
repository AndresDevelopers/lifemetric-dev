import { cookies } from 'next/headers';
import { redisClient } from './redis';

/**
 * Utility to sign and verify session tokens using native Web Crypto API.
 * This is compatible with both Node.js (Server Actions) and Edge Runtime (Middleware).
 */

const getSessionSecret = () => {
  const configuredSecret =
    process.env.AUTH_SECRET ??
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (configuredSecret) {
    return configuredSecret;
  }

  const stableInfrastructureSecret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.DATABASE_URL;
  if (stableInfrastructureSecret) {
    return stableInfrastructureSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing AUTH_SECRET (or SESSION_SECRET/NEXTAUTH_SECRET). Configure a stable session secret to avoid invalidating sessions after restarts.'
    );
  }

  const globalWithSecret = globalThis as typeof globalThis & {
    __lifemetricSessionSecret?: string;
  };

  if (!globalWithSecret.__lifemetricSessionSecret) {
    globalWithSecret.__lifemetricSessionSecret = crypto.randomUUID();
  }

  return globalWithSecret.__lifemetricSessionSecret;
};

const getSecretKey = async () => {
  const secret = getSessionSecret();
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

/**
 * Validates if the session is still active in Redis (one session per user).
 */
export async function isSessionActive(pacienteId: string, sessionId: string): Promise<boolean> {
  if (!redisClient) return true; // Fallback if Redis is not configured
  try {
    const activeSessionId = await redisClient.get(`active_session:${pacienteId}`);
    // If no session is found, we allow it (might be a legacy session or Redis cleared)
    return !activeSessionId || activeSessionId === sessionId;
  } catch (error) {
    console.error('Redis active session check failed:', error);
    return true; // Resilience fallback
  }
}

export async function setSession(pacienteId: string) {
  const sessionId = crypto.randomUUID();
  const payload = JSON.stringify({ pacienteId, sessionId, timestamp: Date.now() });
  const token = await signSession(payload);

  // Store active session in Redis to prevent concurrent logins
  if (redisClient) {
    try {
      await redisClient.set(`active_session:${pacienteId}`, sessionId, { ex: 86400 * 7 });
    } catch (error) {
      console.error('Failed to store active session in Redis:', error);
    }
  }

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
  const sessionToken = cookieStore.get('lifemetric_session')?.value;
  
  if (sessionToken && redisClient) {
    try {
      const payloadStr = await verifySession(sessionToken);
      if (payloadStr) {
        const { pacienteId } = JSON.parse(payloadStr);
        await redisClient.del(`active_session:${pacienteId}`);
      }
    } catch {
      // Ignore errors during logout
    }
  }

  cookieStore.delete('lifemetric_session');
}
