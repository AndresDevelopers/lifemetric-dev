'use client';

import React, { useEffect, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

type TurnstileWidgetProps = {
  readonly onVerify: (token: string) => void;
  readonly onRequirementChange?: (isRequired: boolean) => void;
  readonly onProviderChange?: (provider: 'turnstile' | 'botid') => void;
};

export function TurnstileWidget({ onVerify, onRequirementChange, onProviderChange }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const hasResolved = useRef(false);

  useEffect(() => {
    if (!siteKey) {
      onProviderChange?.('botid');
      onRequirementChange?.(false);
      onVerify('');
      return;
    }

    onProviderChange?.('turnstile');
    onRequirementChange?.(true);
    const timeout = window.setTimeout(() => {
      if (hasResolved.current) {
        return;
      }
      hasResolved.current = true;
      onProviderChange?.('botid');
      onRequirementChange?.(false);
      onVerify('');
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [siteKey, onProviderChange, onRequirementChange, onVerify]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="flex justify-center my-4">
      <Turnstile 
        siteKey={siteKey} 
        onSuccess={(token) => {
          hasResolved.current = true;
          onProviderChange?.('turnstile');
          onRequirementChange?.(true);
          onVerify(token);
        }}
        onError={() => {
          hasResolved.current = true;
          onProviderChange?.('botid');
          onRequirementChange?.(false);
          onVerify('');
        }}
        onExpire={() => {
          onProviderChange?.('turnstile');
          onRequirementChange?.(true);
          onVerify('');
        }}
      />
    </div>
  );
}
