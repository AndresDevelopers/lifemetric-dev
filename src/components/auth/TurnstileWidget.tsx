'use client';

import React, { useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

export function TurnstileWidget({ onVerify }: { readonly onVerify: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // En desarrollo sin siteKey configurada, permitimos el paso automáticamente
  useEffect(() => {
    if (!siteKey || siteKey === '1x00000000000000000000AA') {
      onVerify('dev-bypass-token');
    }
  }, [siteKey, onVerify]);

  if (!siteKey || siteKey === '1x00000000000000000000AA') {
    return null; // No mostramos nada en modo bypass local
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
