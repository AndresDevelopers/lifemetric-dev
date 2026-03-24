'use client';

import { ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Locale } from '@/lib/i18n';
import { useLocale } from '@/components/providers/LocaleProvider';

export default function LanguageSwitcher({
  className = '',
  compact = false,
}: Readonly<{
  className?: string;
  compact?: boolean;
}>) {
  const router = useRouter();
  const { locale, setLocale, messages } = useLocale();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setLocale(event.target.value as Locale, true);
    router.refresh();
  };

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="material-symbols-outlined text-[20px] text-[var(--color-primary)]">language</span>
      {!compact && (
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          {messages.common.language}
        </span>
      )}
      <select
        aria-label={messages.common.language}
        className="rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        onChange={handleChange}
        value={locale}
      >
        <option value="es">{messages.common.spanish}</option>
        <option value="en">{messages.common.english}</option>
      </select>
    </label>
  );
}
