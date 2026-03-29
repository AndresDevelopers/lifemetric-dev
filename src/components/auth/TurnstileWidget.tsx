'use client';

import React, { useEffect, useRef } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

type TurnstileWidgetProps = {
  readonly onVerify: (token: string) => void;
  readonly onRequirementChange?: (isRequired: boolean) => void;
};

export function TurnstileWidget({ onVerify, onRequirementChange }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const hasResolved = useRef(false);

  useEffect(() => {
    if (!siteKey) {
      onRequirementChange?.(false);
      onVerify('');
      return;
    }

    onRequirementChange?.(true);
    const timeout = window.setTimeout(() => {
      if (hasResolved.current) {
        return;
      }
      hasResolved.current = true;
      onRequirementChange?.(false);
      onVerify('');
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [siteKey, onRequirementChange, onVerify]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="flex justify-center my-4">
      <Turnstile 
        siteKey={siteKey} 
        onSuccess={(token) => {
          hasResolved.current = true;
          onRequirementChange?.(true);
          onVerify(token);
        }}
        onError={() => {
          hasResolved.current = true;
          onRequirementChange?.(false);
          onVerify('');
        }}
        onExpire={() => {
          onRequirementChange?.(true);
          onVerify('');
        }}
      />
    </div>
  );
}
