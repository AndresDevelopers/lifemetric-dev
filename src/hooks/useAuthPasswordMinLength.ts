'use client';

import { useEffect, useState } from 'react';
export function useAuthPasswordMinLength() {
  const [minLength, setMinLength] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPasswordPolicy() {
      try {
        const response = await fetch('/api/auth/password-policy', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { minLength?: number };
        if (isMounted && typeof data.minLength === 'number' && Number.isFinite(data.minLength) && data.minLength >= 1) {
          setMinLength(data.minLength);
        }
      } catch {
        // Keep the UI generic until the password policy can be loaded.
      }
    }

    void loadPasswordPolicy();

    return () => {
      isMounted = false;
    };
  }, []);

  return minLength;
}
