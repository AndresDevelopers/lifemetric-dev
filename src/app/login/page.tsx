'use client';

import React, { useState, useEffect, useActionState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/actions/auth';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, undefined);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [isCaptchaRequired, setIsCaptchaRequired] = useState<boolean>(true);
  const [captchaProvider, setCaptchaProvider] = useState<'turnstile' | 'botid'>('turnstile');
  const router = useRouter();
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Lifemetric';
  const appBrandLogoUrl = process.env.NEXT_PUBLIC_APP_BRAND_LOGO_URL?.trim() ?? '';
  const appIconUrl = process.env.NEXT_PUBLIC_APP_ICON_URL?.trim() ?? '';
  const { locale, messages } = useLocale();
  const loginMessages = messages.auth.login;

  useEffect(() => {
    if (state?.success) {
      router.push('/');
    }
  }, [state, router]);

  return (
    <div className="w-full py-12 px-4 sm:px-8 relative grid place-items-start md:place-items-center">
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-primary-container)] rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] bg-[var(--color-tertiary-container)] rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-[var(--color-secondary-container)] rounded-full mix-blend-multiply filter blur-[150px] opacity-40 animate-blob animation-delay-4000"></div>

      <div className="glass-surface w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20 relative z-10 transition-all duration-500 hover:shadow-[var(--color-primary-fixed-dim)]/20 hover:shadow-3xl">
        
        {/* Left Side: Branding / Clinical Aesthetic */}
        <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-between bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-surface-tint)] text-[var(--color-on-primary)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          
          <div className="z-10 relative">
            {appBrandLogoUrl ? (
              <div className="w-full py-4 md:py-6">
                <img
                  src={appBrandLogoUrl}
                  alt={appName}
                  className="w-full h-auto max-h-44 md:max-h-52 object-contain"
                />
              </div>
            ) : (
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 flex items-center gap-3">
                {appIconUrl ? (
                  <img src={appIconUrl} alt={appName} className="w-12 h-12 md:w-14 md:h-14 rounded-2xl object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-5xl">vital_signs</span>
                )}
                {' '}{appName}
              </h1>
            )}
            <p className="text-[var(--color-primary-fixed)] text-lg md:text-xl font-medium mb-8 leading-relaxed">
              {messages.common.appDescription} <br/> {messages.common.appDescriptionDetail}
            </p>
          </div>

          <div className="z-10 relative mt-12 hidden md:block">
            <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/10">
              <p className="text-sm font-medium text-[var(--color-primary-fixed)] mb-2 uppercase tracking-wider">{loginMessages.metricsToday}</p>
              <div className="flex gap-4 items-end">
                <div className="text-3xl font-bold">95 <span className="text-lg font-normal text-[var(--color-primary-fixed)]">mg/dL</span></div>
                <div className="h-8 w-[2px] bg-white/20"></div>
                <div className="text-3xl font-bold">120/80 <span className="text-lg font-normal text-[var(--color-primary-fixed)]">mmHg</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="md:w-1/2 p-10 md:p-16 flex flex-col justify-center bg-[var(--color-surface-container-lowest)]/80 backdrop-blur-xl">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-[var(--color-on-surface)] mb-2">{loginMessages.title}</h2>
            <p className="text-[var(--color-on-surface-variant)]">{loginMessages.subtitle}</p>
          </div>

          {state?.error && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-error-container)] text-[var(--color-on-error-container)] flex items-center gap-2 text-sm font-semibold">
              <span className="material-symbols-outlined">error</span>
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-6">
            <input type="hidden" name="captchaToken" value={captchaToken} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="captchaProvider" value={captchaProvider} />

            <div className="space-y-2 group">
              <label htmlFor="email" className="text-sm font-semibold text-[var(--color-on-surface-variant)] group-focus-within:text-[var(--color-primary)] transition-colors">
                {loginMessages.email}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-outline)] group-focus-within:text-[var(--color-primary)] transition-colors">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  name="email"
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all font-body text-[var(--color-on-surface)]"
                  placeholder={locale === 'es' ? 'tu@email.com' : 'you@email.com'}
                  required
                />
              </div>
            </div>

            <div className="space-y-2 group">
              <div className="flex justify-between items-center text-sm">
                <label htmlFor="password" className="font-semibold text-[var(--color-on-surface-variant)] group-focus-within:text-[var(--color-primary)] transition-colors">
                  {loginMessages.password}
                </label>
                <Link href="/recuperar" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-on-primary-fixed-variant)] transition-colors">
                  {loginMessages.forgotPassword}
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-outline)] group-focus-within:text-[var(--color-primary)] transition-colors">
                  lock
                </span>
                <input
                  id="password"
                  type="password"
                  name="password"
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all font-body text-[var(--color-on-surface)]"
                  placeholder="••••••••"
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
              className="w-full py-3.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-on-primary-fixed-variant)] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[var(--color-primary)]/30 hover:shadow-[var(--color-primary)]/50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden relative"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  {' '}{loginMessages.submitting}
                </>
              ) : (
                <>
                  {loginMessages.submit}
                  {' '}<span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-[var(--color-outline-variant)] text-center">
            <p className="text-[var(--color-on-surface-variant)] mb-2">
              {loginMessages.noAccount}
            </p>
            <Link 
              href="/registro" 
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-xl">person_add</span>
              {loginMessages.registerLink}
            </Link>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <LanguageSwitcher className="justify-center" />
            <p className="max-w-xs text-xs text-[var(--color-on-surface-variant)]">
              {messages.common.languageHelper}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
