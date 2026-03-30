'use client';

import React, { useState, useEffect, useActionState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/actions/auth';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLocale } from '@/components/providers/LocaleProvider';

type LoginPanelProps = {
  action: (payload: FormData) => void;
  isPending: boolean;
  state?: { error?: string; success?: boolean };
  showDeletedMessage: boolean;
  locale: 'es' | 'en';
  captchaToken: string;
  isCaptchaRequired: boolean;
  captchaProvider: 'turnstile' | 'botid';
  setCaptchaToken: (token: string) => void;
  setIsCaptchaRequired: (required: boolean) => void;
  setCaptchaProvider: (provider: 'turnstile' | 'botid') => void;
  loginMessages: ReturnType<typeof useLocale>['messages']['auth']['login'];
  accountDeletedMessage: string;
  languageHelper: string;
  compact?: boolean;
};

function LoginPanel({
  action,
  isPending,
  state,
  showDeletedMessage,
  locale,
  captchaToken,
  isCaptchaRequired,
  captchaProvider,
  setCaptchaToken,
  setIsCaptchaRequired,
  setCaptchaProvider,
  loginMessages,
  accountDeletedMessage,
  languageHelper,
  compact = false,
}: Readonly<LoginPanelProps>) {
  return (
    <div className={compact ? 'space-y-6' : 'space-y-8'}>
      <div className={compact ? 'text-center' : 'text-center md:text-left'}>
        <h2 className={compact ? 'text-4xl font-black text-[var(--color-on-surface)] mb-2' : 'text-3xl font-bold text-[var(--color-on-surface)] mb-2'}>{loginMessages.title}</h2>
        <p className="text-[var(--color-on-surface-variant)] text-base">{loginMessages.subtitle}</p>
      </div>

      {state?.error && (
        <div className="p-4 rounded-2xl bg-[var(--color-error-container)] text-[var(--color-on-error-container)] flex items-center gap-2 text-sm font-semibold">
          <span className="material-symbols-outlined">error</span>
          {state.error}
        </div>
      )}
      {showDeletedMessage && (
        <div className="p-4 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center gap-2 text-sm font-semibold">
          <span className="material-symbols-outlined">check_circle</span>
          {accountDeletedMessage}
        </div>
      )}

      <form action={action} className={compact ? 'space-y-5' : 'space-y-6'}>
        <input type="hidden" name="captchaToken" value={captchaToken} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="captchaProvider" value={captchaProvider} />

        <div className="space-y-2 group">
          <label htmlFor="email" className="text-sm font-semibold text-[var(--color-on-surface-variant)] group-focus-within:text-[var(--color-primary)] transition-colors">
            {loginMessages.email}
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-outline)]">mail</span>
            <input
              id="email"
              type="email"
              name="email"
              className="w-full min-h-12 pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-2xl outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all font-body text-[var(--color-on-surface)]"
              placeholder={locale === 'es' ? 'tu@email.com' : 'you@email.com'}
              required
            />
          </div>
        </div>

        <div className="space-y-2 group">
          <div className="flex justify-between items-center text-sm gap-2">
            <label htmlFor="password" className="font-semibold text-[var(--color-on-surface-variant)] group-focus-within:text-[var(--color-primary)] transition-colors">
              {loginMessages.password}
            </label>
            <Link href="/recuperar" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-on-primary-fixed-variant)] transition-colors">
              {loginMessages.forgotPassword}
            </Link>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-outline)]">lock</span>
            <input
              id="password"
              type="password"
              name="password"
              className="w-full min-h-12 pl-12 pr-4 py-3.5 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-2xl outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition-all font-body text-[var(--color-on-surface)]"
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
          className="w-full min-h-12 py-3.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-on-primary-fixed-variant)] text-white font-semibold rounded-2xl transition-all shadow-lg shadow-[var(--color-primary)]/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

      <div className="pt-4 border-t border-[var(--color-outline-variant)] text-center">
        <p className="text-[var(--color-on-surface-variant)] mb-2">{loginMessages.noAccount}</p>
        <Link
          href="/registro"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[var(--color-primary)] text-[var(--color-primary)] font-semibold hover:bg-[var(--color-primary)] hover:text-white transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-xl">person_add</span>
          {loginMessages.registerLink}
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <LanguageSwitcher className="justify-center" />
        <p className="max-w-xs text-xs text-[var(--color-on-surface-variant)]">{languageHelper}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, undefined);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [isCaptchaRequired, setIsCaptchaRequired] = useState<boolean>(true);
  const [captchaProvider, setCaptchaProvider] = useState<'turnstile' | 'botid'>('turnstile');
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const showDeletedMessage = searchParams.get('accountDeleted') === '1';

  return (
    <div className="w-full min-h-screen relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-primary-container)] rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] bg-[var(--color-tertiary-container)] rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-[var(--color-secondary-container)] rounded-full mix-blend-multiply filter blur-[150px] opacity-40 animate-blob animation-delay-4000"></div>

      <main className="relative z-10">
        <section className="md:hidden min-h-screen flex flex-col bg-gradient-to-b from-[#0c5fae] via-[#0a4f93] to-[#083f78]">
          <div className="px-5 pt-8 pb-24 text-white">
            <span className="inline-flex items-center rounded-full border border-cyan-100/30 bg-[#04264f]/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/90 mb-5">
              {locale === 'es' ? 'Plataforma clínica segura' : 'Secure clinical platform'}
            </span>
            <div className="rounded-3xl border border-cyan-100/25 bg-[#082f5b]/50 backdrop-blur-sm p-4 shadow-[0_12px_36px_rgba(4,18,43,0.35)]">
              {appBrandLogoUrl ? (
                <Image
                  src={appBrandLogoUrl}
                  alt={appName}
                  width={560}
                  height={220}
                  unoptimized
                  className="w-full h-auto max-h-28 object-contain"
                />
              ) : (
                <div className="flex items-center justify-center gap-3 py-3">
                  {appIconUrl ? (
                    <Image src={appIconUrl} alt={appName} width={48} height={48} unoptimized className="w-12 h-12 rounded-2xl object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-5xl">vital_signs</span>
                  )}
                  <h1 className="text-3xl font-black tracking-tight">{appName}</h1>
                </div>
              )}
            </div>
            <p className="mt-6 text-xl leading-relaxed font-semibold text-blue-50 max-w-[22ch]">
              {messages.common.appDescription}
              <br />
              {messages.common.appDescriptionDetail}
            </p>
          </div>

          <div className="-mt-14 flex-1 rounded-t-[2.2rem] bg-[var(--color-surface-container-lowest)] px-5 pt-8 pb-8 shadow-[0_-12px_40px_rgba(0,0,0,0.22)]">
            <LoginPanel
              action={action}
              isPending={isPending}
              state={state}
              showDeletedMessage={showDeletedMessage}
              locale={locale}
              captchaToken={captchaToken}
              isCaptchaRequired={isCaptchaRequired}
              captchaProvider={captchaProvider}
              setCaptchaToken={setCaptchaToken}
              setIsCaptchaRequired={setIsCaptchaRequired}
              setCaptchaProvider={setCaptchaProvider}
              loginMessages={loginMessages}
              accountDeletedMessage={messages.settings.accountDeleted}
              languageHelper={messages.common.languageHelper}
              compact
            />
          </div>
        </section>

        <section className="hidden md:grid place-items-center min-h-screen p-8">
          <div className="glass-surface w-full max-w-5xl rounded-3xl shadow-2xl flex overflow-hidden border border-white/20 transition-all duration-500 hover:shadow-[var(--color-primary-fixed-dim)]/20 hover:shadow-3xl">
            <div className="w-1/2 p-16 flex flex-col justify-between bg-gradient-to-br from-[#0a3f78] via-[#0b5aa4] to-[#1280cc] text-[var(--color-on-primary)] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(103,232,249,0.12),transparent_40%)] pointer-events-none"></div>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>

              <div className="z-10 relative">
                <span className="inline-flex items-center rounded-full border border-cyan-100/30 bg-[#04264f]/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/90 mb-4">
                  {locale === 'es' ? 'Plataforma clínica segura' : 'Secure clinical platform'}
                </span>
                {appBrandLogoUrl ? (
                  <div className="w-full max-w-[320px] py-6 px-6 rounded-3xl bg-[#082f5b]/55 border border-cyan-100/25 backdrop-blur-sm shadow-[0_12px_36px_rgba(4,18,43,0.35)]">
                    <Image
                      src={appBrandLogoUrl}
                      alt={appName}
                      width={560}
                      height={220}
                      unoptimized
                      className="w-full h-auto max-h-52 object-contain drop-shadow-[0_10px_24px_rgba(220,244,255,0.34)]"
                    />
                  </div>
                ) : (
                  <h1 className="text-5xl font-bold tracking-tight mb-4 flex items-center gap-3">
                    {appIconUrl ? (
                      <Image src={appIconUrl} alt={appName} width={56} height={56} unoptimized className="w-14 h-14 rounded-2xl object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-5xl">vital_signs</span>
                    )}
                    {' '}{appName}
                  </h1>
                )}
                <p className="text-[#e7f6ff] text-xl font-medium mb-1 mt-5 leading-relaxed max-w-[32ch]">
                  {messages.common.appDescription} <br /> {messages.common.appDescriptionDetail}
                </p>
              </div>

              <div className="z-10 relative mt-12">
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

            <div className="w-1/2 p-16 flex flex-col justify-center bg-[var(--color-surface-container-lowest)]/80 backdrop-blur-xl">
              <LoginPanel
                action={action}
                isPending={isPending}
                state={state}
                showDeletedMessage={showDeletedMessage}
                locale={locale}
                captchaToken={captchaToken}
                isCaptchaRequired={isCaptchaRequired}
                captchaProvider={captchaProvider}
                setCaptchaToken={setCaptchaToken}
                setIsCaptchaRequired={setIsCaptchaRequired}
                setCaptchaProvider={setCaptchaProvider}
                loginMessages={loginMessages}
                accountDeletedMessage={messages.settings.accountDeleted}
                languageHelper={messages.common.languageHelper}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
