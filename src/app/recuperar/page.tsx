'use client';

import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import { recoveryAction } from '@/actions/auth';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function RecoverPage() {
  const [state, action, isPending] = useActionState(recoveryAction, undefined);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const { locale, messages } = useLocale();
  const recoverMessages = messages.auth.recover;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--color-surface-container-low)] p-4 sm:p-8 relative overflow-y-auto overflow-x-hidden">
      
      {/* Abstract Background Shapes */}
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

        {state?.success ? (
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

            <TurnstileWidget onVerify={(t) => setCaptchaToken(t)} />

            <button
              type="submit"
              disabled={isPending || !captchaToken}
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
