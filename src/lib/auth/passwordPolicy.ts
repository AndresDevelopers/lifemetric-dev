import { z } from 'zod';

export const AUTH_PASSWORD_MIN_LENGTH = 6;

export function getAuthPasswordSchema(minLength = AUTH_PASSWORD_MIN_LENGTH) {
  return z.string().min(minLength);
}

export const authPasswordSchema = getAuthPasswordSchema();

export function formatPasswordMinLengthPlaceholder(locale: 'es' | 'en', minLength: number) {
  return locale === 'es' ? `Min. ${minLength} caracteres` : `Min. ${minLength} characters`;
}

export function isSupabaseWeakPasswordError(message: string): boolean {
  return /password|characters|character|at least|min(?:imum)?/i.test(message);
}
