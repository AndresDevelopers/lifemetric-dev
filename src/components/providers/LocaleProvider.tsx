'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { Locale, getMessages, persistLocale } from '@/lib/i18n';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale, explicit?: boolean) => void;
  messages: ReturnType<typeof getMessages>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
}: Readonly<{
  children: React.ReactNode;
  initialLocale: Locale;
}>) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale, explicit = true) => {
        persistLocale(nextLocale, explicit);
        setLocaleState(nextLocale);
      },
      messages: getMessages(locale),
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }

  return context;
}
