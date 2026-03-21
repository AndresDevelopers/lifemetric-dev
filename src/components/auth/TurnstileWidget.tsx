'use client';

import { Turnstile } from '@marsidev/react-turnstile';
import { env } from 'process';

export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

  return (
    <div className="flex justify-center my-4">
      <Turnstile siteKey={siteKey} onSuccess={onVerify} theme="auto" />
    </div>
  );
}
