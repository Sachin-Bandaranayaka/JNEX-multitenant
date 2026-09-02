'use client';

// Shared "email me a code" behaviour for the sign-in and password-reset
// screens: one request in flight at a time, a cooldown so the resend button
// cannot be used to hammer someone's inbox, and the server's wording passed
// through untouched (it is deliberately vague about whether the account
// exists, and second-guessing it here would undo that).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthCodePurpose } from '@/lib/auth-code-purpose';
import { AUTH_CODE_RESEND_COOLDOWN_SECONDS } from '@/lib/auth-codes-shared';

export function useCodeRequest(purpose: AuthCodePurpose) {
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cooldown]);

  const requestCode = useCallback(
    async (email: string): Promise<{ ok: boolean; message: string }> => {
      setIsSending(true);
      try {
        const response = await fetch('/api/auth/code/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, purpose }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          return { ok: false, message: data.error || 'We could not send the code. Please try again.' };
        }

        setCooldown(AUTH_CODE_RESEND_COOLDOWN_SECONDS);
        return { ok: true, message: data.message || 'Check your email for the code.' };
      } catch {
        return { ok: false, message: 'Network error. Check your connection and try again.' };
      } finally {
        setIsSending(false);
      }
    },
    [purpose],
  );

  return { requestCode, isSending, cooldown };
}
