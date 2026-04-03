import { z } from 'zod';

export const AUTH_PASSWORD_MIN_LENGTH = 6;

export function getAuthPasswordSchema(minLength = AUTH_PASSWORD_MIN_LENGTH) {
  return z.string().min(minLength);
}

export const authPasswordSchema = getAuthPasswordSchema();

export function formatPasswordMinLengthPlaceholder(locale: 'es' | 'en', minLength: number) {
  return locale === 'es' ? `Min. ${minLength} caracteres` : `Min. ${minLength} characters`;
}

export function formatPasswordMinLengthValidationMessage(locale: 'es' | 'en', minLength: number) {
  return locale === 'es'
    ? `La contraseña debe tener al menos ${minLength} caracteres.`
    : `The password must contain at least ${minLength} characters.`;
}

export function getPasswordStrengthScore(password: string, minLength: number): number {
  if (!password) return 0;

  let score = 0;
  if (password.length >= minLength) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function isSupabaseWeakPasswordError(message: string): boolean {
  return /password|characters|character|at least|min(?:imum)?/i.test(message);
}
