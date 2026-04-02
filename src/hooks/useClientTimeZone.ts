'use client';

import { useEffect, useState } from 'react';

const DEFAULT_TIME_ZONE = 'UTC';

export function useClientTimeZone() {
  const [timeZone, setTimeZone] = useState<string>(DEFAULT_TIME_ZONE);

  useEffect(() => {
    const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detectedTimeZone) {
      setTimeZone(detectedTimeZone);
    }
  }, []);

  return timeZone;
}
