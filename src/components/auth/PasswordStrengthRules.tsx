'use client';

import { getPasswordStrengthScore } from '@/lib/auth/passwordPolicy';

type Props = {
  locale: 'es' | 'en';
  password: string;
  minLength: number;
};

export function PasswordStrengthRules({ locale, password, minLength }: Readonly<Props>) {
  const score = getPasswordStrengthScore(password, minLength);
  const labels = locale === 'es'
    ? ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte']
    : ['Very weak', 'Weak', 'Medium', 'Strong', 'Very strong'];
  const barClass = ['bg-slate-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'][score];
  const hasUpperLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  const rules = [
    {
      ok: password.length >= minLength,
      text: locale === 'es' ? `Mínimo ${minLength} caracteres (requerido por Auth)` : `Minimum ${minLength} characters (required by Auth)`,
    },
    {
      ok: hasUpperLower,
      text: locale === 'es' ? 'Combinar mayúsculas y minúsculas (recomendado)' : 'Mix uppercase and lowercase (recommended)',
    },
    {
      ok: hasNumber,
      text: locale === 'es' ? 'Incluir al menos un número (recomendado)' : 'Include at least one number (recommended)',
    },
    {
      ok: hasSymbol,
      text: locale === 'es' ? 'Incluir un símbolo, por ejemplo !@#$ (recomendado)' : 'Include a symbol, e.g. !@#$ (recommended)',
    },
  ];

  return (
    <div className="space-y-2 px-1" aria-live="polite">
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-on-surface-variant)]">
        <span>{locale === 'es' ? 'Seguridad de contraseña' : 'Password strength'}</span>
        <span>{labels[score]}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200/70 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${(score / 4) * 100}%` }} />
      </div>
      <ul className="space-y-1 pt-1">
        {rules.map((rule) => (
          <li key={rule.text} className="flex items-start gap-2 text-[11px]">
            <span className={`material-symbols-outlined text-sm leading-none ${rule.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
              {rule.ok ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <span className={rule.ok ? 'text-emerald-700' : 'text-[var(--color-on-surface-variant)]'}>{rule.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
