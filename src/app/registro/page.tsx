'use client';

import React, { useState, useActionState } from 'react';
import Link from 'next/link';
import { registerAction } from '@/actions/auth';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { useLocale } from '@/components/providers/LocaleProvider';
import { translateTemplate } from '@/lib/i18n';
import { PROMO_FOCUS_PRODUCTS, REGISTER_DIAGNOSIS_OPTIONS } from '@/lib/productCatalog';

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(registerAction, undefined);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [isCaptchaRequired, setIsCaptchaRequired] = useState<boolean>(true);
  const [captchaProvider, setCaptchaProvider] = useState<'turnstile' | 'botid'>('turnstile');
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Lifemetric';
  const { locale, messages } = useLocale();
  const registerMessages = messages.auth.register;
  const diagnosisOptions = REGISTER_DIAGNOSIS_OPTIONS[locale];

  return (
    <div className="w-full py-12 px-4 sm:px-8 relative grid place-items-start md:place-items-center">
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-tertiary-container)] rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob"></div>
      <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[50%] bg-[var(--color-primary-container)] rounded-full mix-blend-multiply filter blur-[100px] opacity-30 animate-blob animation-delay-2000"></div>

      <div className="glass-surface w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-white/20 relative z-10 transition-all duration-500 hover:shadow-[var(--color-tertiary-fixed-dim)]/20 hover:shadow-3xl">
        
        {/* Left Side: Summary / Benefits */}
        <div className="md:w-5/12 p-8 md:p-12 flex flex-col justify-center bg-gradient-to-br from-[var(--color-tertiary)] to-[var(--color-tertiary-container)] text-[var(--color-on-tertiary)] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          
          <div className="z-10 relative">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-4xl">monitor_heart</span>
              {' '}{registerMessages.heroTitle}
            </h1>
            <p className="text-[var(--color-tertiary-fixed)] text-lg mb-8 leading-relaxed">
              {translateTemplate(registerMessages.heroSubtitle, { appName })}
            </p>
          </div>
        </div>

        <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-[var(--color-surface-container-lowest)]/80 backdrop-blur-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-on-surface)] mb-1">{registerMessages.title}</h2>
            <p className="text-[var(--color-on-surface-variant)] text-sm">{registerMessages.subtitle}</p>
          </div>

          {state?.error && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-error-container)] text-[var(--color-on-error-container)] flex items-center gap-2 text-sm font-semibold">
              <span className="material-symbols-outlined">error</span>
              {state.error}
            </div>
          )}

          {state?.success && state?.message && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center gap-2 text-sm font-semibold">
              <span className="material-symbols-outlined">mail</span>
              {state.message}
            </div>
          )}

          <form action={action} className="space-y-4">
            <input type="hidden" name="captchaToken" value={captchaToken} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="captchaProvider" value={captchaProvider} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label htmlFor="nombre" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.firstName}</label>
                 <input id="nombre" type="text" name="nombre" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
               
               <div className="space-y-1">
                 <label htmlFor="apellido" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.lastName}</label>
                 <input id="apellido" type="text" name="apellido" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label htmlFor="email" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.email}</label>
                 <input id="email" type="email" name="email" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
               
               <div className="space-y-1">
                 <label htmlFor="password" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.password}</label>
                 <input id="password" type="password" name="password" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" placeholder={registerMessages.passwordPlaceholder} required />
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="space-y-1">
                 <label htmlFor="fechaNacimiento" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.age}</label>
                 <input id="fechaNacimiento" type="date" name="fechaNacimiento" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required />
               </div>
               
               <div className="space-y-1 sm:col-span-2">
                 <label htmlFor="sexo" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.biologicalSex}</label>
                 <select id="sexo" name="sexo" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required>
                    <option value="">{messages.common.select}</option>
                    <option value="Masculino">{registerMessages.male}</option>
                    <option value="Femenino">{registerMessages.female}</option>
                 </select>
               </div>
            </div>

            <div className="space-y-1">
                <label htmlFor="diagnostico" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.diagnosis}</label>
                <select id="diagnostico" name="diagnostico" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required>
                  <option value="">{messages.common.select}</option>
                  {diagnosisOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="productoPermitido" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.allowedProduct}</label>
              <select id="productoPermitido" name="productoPermitido" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]" required>
                <option value="">{messages.common.select}</option>
                {PROMO_FOCUS_PRODUCTS.map((product) => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="doctorAsignado" className="text-sm font-semibold text-[var(--color-on-surface-variant)]">{registerMessages.attendingDoctor}</label>
              <select id="doctorAsignado" name="doctorAsignado" className="w-full px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-outline-variant)] rounded-xl outline-none focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/20 transition-all font-body text-sm text-[var(--color-on-surface)]">
                <option value="">{messages.common.select}</option>
                <option value="Renato">Renato</option>
                <option value="Ulysses">Ulysses</option>
              </select>
            </div>

            <div className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 py-3">
              <label htmlFor="newsletterSubscribed" className="flex items-start gap-3 cursor-pointer">
                <input
                  id="newsletterSubscribed"
                  name="newsletterSubscribed"
                  type="checkbox"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-[var(--color-outline-variant)] text-[var(--color-tertiary)] focus:ring-[var(--color-tertiary)]"
                />
                <span className="text-sm text-[var(--color-on-surface-variant)]">{registerMessages.newsletterOptIn}</span>
              </label>
            </div>

            <TurnstileWidget
              onVerify={(token) => setCaptchaToken(token)}
              onRequirementChange={setIsCaptchaRequired}
              onProviderChange={setCaptchaProvider}
            />

            <button
              type="submit"
              disabled={isPending || (isCaptchaRequired && !captchaToken)}
              className="w-full py-3.5 px-4 bg-[var(--color-tertiary)] hover:bg-[var(--color-on-tertiary-fixed-variant)] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[var(--color-tertiary)]/30 hover:shadow-[var(--color-tertiary)]/50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  {' '}{registerMessages.submitting}
                </>
              ) : (
                registerMessages.submit
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[var(--color-on-surface-variant)] text-sm">
              {registerMessages.alreadyHaveAccount}{' '}
              <Link href="/login" className="font-semibold text-[var(--color-tertiary)] hover:underline ml-1">
                {registerMessages.loginLink}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
