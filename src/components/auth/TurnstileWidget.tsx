'use client';

import React, { useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

export function TurnstileWidget({ onVerify }: { readonly onVerify: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Si no hay siteKey configurada en absoluto, permitimos el paso automáticamente para desarrollo
  useEffect(() => {
    if (!siteKey) {
      onVerify('dev-bypass-token');
    }
  }, [siteKey, onVerify]);

  if (!siteKey) {
    return null; // Solo ocultamos si no hay ninguna llave (ni siquiera la de test)
  }

  return (
    <div className="flex justify-center my-4">
      <Turnstile 
        siteKey={siteKey} 
        onSuccess={onVerify} 
        onError={() => onVerify('error-bypass-token')}
        onExpire={() => onVerify('')}
      />
    </div>
  );
}
