'use client';

import React, { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { recoveryAction, syncRecoveredPasswordAction } from '@/actions/auth';
import { PasswordStrengthRules } from '@/components/auth/PasswordStrengthRules';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { useLocale } from '@/components/providers/LocaleProvider';
import {
  AUTH_PASSWORD_MIN_LENGTH,
  formatPasswordMinLengthPlaceholder,
  formatPasswordMinLengthValidationMessage,
  isSupabaseWeakPasswordError,
} from '@/lib/auth/passwordPolicy';
import { supabase } from '@/lib/supabase';
import { useAuthPasswordMinLength } from '@/hooks/useAuthPasswordMinLength';

export default function RecoverPage() {
  const [state, action, isPending] = useActionState(recoveryAction, undefined);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [isCaptchaRequired, setIsCaptchaRequired] = useState<boolean>(true);
  const [captchaProvider, setCaptchaProvider] = useState<'turnstile' | 'botid'>('turnstile');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isResetPending, startResetTransition] = useTransition();
  const { locale, messages } = useLocale();
  const passwordMinLength = useAuthPasswordMinLength();
  const recoverMessages = messages.auth.recover;
  const authMessages = messages.auth.messages;
  const effectivePasswordMinLength = passwordMinLength ?? AUTH_PASSWORD_MIN_LENGTH;
  const passwordPlaceholder = formatPasswordMinLengthPlaceholder(locale, effectivePasswordMinLength);

  useEffect(() => {
    let isMounted = true;

    async function initializeRecoverySession() {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(currentUrl.hash.startsWith('#') ? currentUrl.hash.slice(1) : '');
      const code = currentUrl.searchParams.get('code');
      const tokenHash = currentUrl.searchParams.get('token_hash');
      const type = currentUrl.searchParams.get('type') ?? hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const isRecoveryLink = type === 'recovery' || Boolean(code || tokenHash || accessToken);

      if (!isRecoveryLink) {
        if (isMounted) {
          setIsRecoveryReady(true);
        }
        return;
      }

      if (isMounted) {
        setIsRecoveryMode(true);
        setResetError(null);
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
          if (error) {
            throw error;
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            throw error;
          }
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user?.email) {
          throw error ?? new Error('Invalid recovery user');
        }

        if (isMounted) {
          setRecoveryEmail(data.user.email);
          window.history.replaceState({}, document.title, currentUrl.pathname);
        }
      } catch {
        if (isMounted) {
          setResetError(
            locale === 'es'
              ? 'El enlace de recuperación no es válido o ya expiró.'
              : 'The recovery link is invalid or has already expired.'
          );
        }
      } finally {
        if (isMounted) {
          setIsRecoveryReady(true);
        }
      }
    }

    void initializeRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [locale]);

  const handleResetPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (newPassword.length < effectivePasswordMinLength) {
      setResetError(formatPasswordMinLengthValidationMessage(locale, effectivePasswordMinLength));
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError(locale === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }

    startResetTransition(async () => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setResetError(
          isSupabaseWeakPasswordError(error.message)
            ? formatPasswordMinLengthValidationMessage(locale, effectivePasswordMinLength)
            : authMessages.recoveryError
        );
        return;
      }

      const syncState = await syncRecoveredPasswordAction({
        email: recoveryEmail,
        password: newPassword,
        locale,
      });
      if (syncState?.error) {
        setResetError(syncState.error);
        return;
      }

      setResetSuccess(
        locale === 'es'
          ? 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.'
          : 'Your password was updated successfully. You can sign in now.'
      );
      setNewPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-container-low)] p-4 sm:p-8 relative overflow-y-auto overflow-x-hidden">
      <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-[var(--color-secondary-container)] rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob"></div>

      <div className="glass-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20 relative z-10 transition-all duration-500 hover:shadow-[var(--color-secondary-fixed-dim)]/20 hover:shadow-3xl p-8 md:p-12">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-5xl mb-4 text-[var(--color-secondary)]">lock_reset</span>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-[var(--color-on-surface)]">
            {recoverMessages.title}
          </h1>
          <p className="text-[var(--color-on-surface-variant)] text-sm">
            {recoverMessages.subtitle}
          </p>
        </div>

        {state?.error && (
          <div className="mb-6 mx-auto p-4 rounded-xl bg-[var(--color-error-container)] text-[var(--color-on-error-container)] flex items-center gap-2 text-sm font-semibold">
            <span className="material-symbols-outlined">error</span>
            {state.error}
          </div>
        )}

        {!isRecoveryReady ? (
          <div className="py-8 text-center text-sm font-semibold text-[var(--color-on-surface-variant)]">
            {locale === 'es' ? 'Validando enlace de recuperación...' : 'Validating recovery link...'}
          </div>
        ) : isRecoveryMode ? (
          <div className="space-y-6">
            {resetError && (
              <div className="p-4 rounded-xl bg-[var(--color-error-container)] text-[var(--color-on-error-container)] flex items-center gap-2 text-sm font-semibold">
                <span className="material-symbols-outlined">error</span>
                {resetError}
              </div>
            )}

            {resetSuccess ? (
              <div className="p-6 rounded-xl bg-[var(--color-primary-container)]/10 text-[var(--color-primary)] flex flex-col items-center gap-3 text-center border border-[var(--color-primary)]/20">
                <span className="material-symbols-outlined text-4xl">verified_user</span>
                <p className="font-medium text-sm">{resetSuccess}</p>
                <Link href="/login" className="mt-2 px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-on-primary-fixed-variant)] transition-colors">
                  {recoverMessages.backToLogin}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--color-on-surface-variant)]">
                    {recoverMessages.email}
                  </label>
                  <div className="w-full px-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl text-sm font-semibold text-[var(--color-on-surface)]">
                    {recoveryEmail}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="new-password" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">
                    {messages.settings.newPassword}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    minLength={effectivePasswordMinLength}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-secondary)] focus:ring-2 focus:ring-[var(--color-secondary)]/20 transition-all font-body text-[var(--color-on-surface)]"
                    placeholder={passwordPlaceholder}
                    required
                  />
                  <PasswordStrengthRules
                    locale={locale}
                    password={newPassword}
                    minLength={effectivePasswordMinLength}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm-password" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">
                    {locale === 'es' ? 'Confirmar contraseña' : 'Confirm password'}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    minLength={effectivePasswordMinLength}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-secondary)] focus:ring-2 focus:ring-[var(--color-secondary)]/20 transition-all font-body text-[var(--color-on-surface)]"
                    placeholder={passwordPlaceholder}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isResetPending || !recoveryEmail}
                  className="w-full py-3.5 px-4 bg-[var(--color-secondary)] hover:bg-[var(--color-on-secondary-fixed-variant)] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[var(--color-secondary)]/30 hover:shadow-[var(--color-secondary)]/50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResetPending
                    ? (locale === 'es' ? 'Actualizando...' : 'Updating...')
                    : (locale === 'es' ? 'Guardar nueva contraseña' : 'Save new password')}
                </button>
              </form>
            )}
          </div>
        ) : state?.success ? (
          <div className="mb-6 p-6 rounded-xl bg-[var(--color-primary-container)]/10 text-[var(--color-primary)] flex flex-col items-center gap-3 text-center border border-[var(--color-primary)]/20">
            <span className="material-symbols-outlined text-4xl">mark_email_read</span>
            <p className="font-medium text-sm">
              {state.message}
            </p>
            <Link href="/login" className="mt-4 px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--color-on-primary-fixed-variant)] transition-colors">{recoverMessages.backToHome}</Link>
          </div>
        ) : (
          <form action={action} className="space-y-6">
            <input type="hidden" name="captchaToken" value={captchaToken} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="captchaProvider" value={captchaProvider} />

            <div className="space-y-2 group">
              <label htmlFor="email" className="text-sm font-semibold text-[var(--color-on-surface-variant)] group-focus-within:text-[var(--color-secondary)] transition-colors">
                {recoverMessages.email}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-outline)] group-focus-within:text-[var(--color-secondary)] transition-colors">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  name="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-secondary)] focus:ring-2 focus:ring-[var(--color-secondary)]/20 transition-all font-body text-[var(--color-on-surface)]"
                  placeholder={locale === 'es' ? 'tu@email.com' : 'you@email.com'}
                  required
                />
              </div>
            </div>

            <TurnstileWidget
              onVerify={(token) => setCaptchaToken(token)}
              onRequirementChange={setIsCaptchaRequired}
              onProviderChange={setCaptchaProvider}
            />

            <button
              type="submit"
              disabled={isPending || (isCaptchaRequired && !captchaToken)}
              className="w-full py-3.5 px-4 bg-[var(--color-secondary)] hover:bg-[var(--color-on-secondary-fixed-variant)] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[var(--color-secondary)]/30 hover:shadow-[var(--color-secondary)]/50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  {' '}{recoverMessages.submitting}
                </>
              ) : (
                recoverMessages.submit
              )}
            </button>

            <div className="mt-6 text-center">
              <Link href="/login" className="font-semibold text-sm text-[var(--color-on-surface-variant)] hover:text-[var(--color-secondary)] hover:underline">
                {recoverMessages.backToLogin}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
