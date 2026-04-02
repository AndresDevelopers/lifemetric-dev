'use client';

import { useEffect, useState } from 'react';
import {
  formatRuntimeDateKey,
  formatRuntimeTimeKey,
  isValidTimeZone,
  RUNTIME_TIMEZONE_COOKIE_NAME,
} from '@/lib/runtimeGeo';

const FALLBACK_TIME_ZONE = 'UTC';

type RuntimeDateTimeDefaults = {
  date: string;
  time: string;
  timeZone: string;
};

function readCookie(cookieName: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.trim().split('=');
    if (rawName === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

function resolveRuntimeTimeZone(): string {
  const cookieTimeZone = readCookie(RUNTIME_TIMEZONE_COOKIE_NAME);
  if (isValidTimeZone(cookieTimeZone)) {
    return cookieTimeZone;
  }

  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (isValidTimeZone(browserTimeZone)) {
    return browserTimeZone;
  }

  return FALLBACK_TIME_ZONE;
}

function buildRuntimeDefaults(timeZone: string, date: Date = new Date()): RuntimeDateTimeDefaults {
  return {
    date: formatRuntimeDateKey(timeZone, date),
    time: formatRuntimeTimeKey(timeZone, date),
    timeZone,
  };
}

export function useRuntimeDateTimeDefaults() {
  const [runtimeDefaults, setRuntimeDefaults] = useState<RuntimeDateTimeDefaults>(() => {
    const initialTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
    return buildRuntimeDefaults(isValidTimeZone(initialTimeZone) ? initialTimeZone : FALLBACK_TIME_ZONE);
  });

  useEffect(() => {
    const runtimeTimeZone = resolveRuntimeTimeZone();
    setRuntimeDefaults(buildRuntimeDefaults(runtimeTimeZone));
  }, []);

  return runtimeDefaults;
}
