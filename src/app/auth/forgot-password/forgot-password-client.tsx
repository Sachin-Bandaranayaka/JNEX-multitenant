'use client';

// Forgotten-password recovery in one screen: ask for the address, prove the
// inbox with an emailed code, choose the new password. The code and the new
// password are submitted together, so there is no reset link to leak through
// browser history, a shared screenshot or a referrer header.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import {
  AuthCodeInput,
  AuthField,
  AuthLinkButton,
  AuthNotice,
  AuthSubmitButton,
  authInputClass,
} from '@/components/auth/auth-ui';
import { useCodeRequest } from '@/components/auth/use-code-request';
import { AUTH_CODE_TTL_MINUTES } from '@/lib/auth-codes-shared';
import { PASSWORD_RULE_TEXT, validatePassword } from '@/lib/password-policy';

export function ForgotPasswordClient() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { requestCode, isSending, cooldown } = useCodeRequest('PASSWORD_RESET');

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const result = await requestCode(email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(result.message);
    setStep('reset');
  };

  const handleResend = async () => {
    setError(null);
    const result = await requestCode(email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice('A new code is on its way.');
    setCode('');
  };

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Checked here as well as on the server so a typo costs a click, not the
    // one-time code -- the server consumes the code before it validates.
    const problem = validatePassword(password);
    if (problem) {
      setError(problem);
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'We could not reset your password. Please try again.');
        setCode('');
        return;
      }

      setNotice(null);
      setStep('done');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="mb-8 text-center text-2xl font-semibold text-slate-700">
        {step === 'done' ? 'Password updated' : 'Reset your password'}
      </h1>

      {error && <AuthNotice tone="error">{error}</AuthNotice>}
      {notice && !error && <AuthNotice tone="success">{notice}</AuthNotice>}

      {step === 'email' && (
        <form onSubmit={handleSendCode} className="space-y-6">
          <p className="text-sm leading-relaxed text-slate-500">
            Enter the email address you sign in with and we&apos;ll send you a{' '}
            {AUTH_CODE_TTL_MINUTES}-minute code to set a new password.
          </p>
          <AuthField id="reset-email" label="Email">
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
              className={authInputClass}
            />
          </AuthField>
          <AuthSubmitButton isLoading={isSending} loadingLabel="Sending...">
            SEND CODE
          </AuthSubmitButton>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleReset} className="space-y-6">
          <p className="text-sm leading-relaxed text-slate-500">
            Enter the code we sent to{' '}
            <span className="font-semibold text-slate-700">{email}</span> and choose a new
            password.
          </p>

          <AuthField id="reset-code" label="6-digit code">
            <AuthCodeInput id="reset-code" value={code} onChange={setCode} autoFocus />
          </AuthField>

          <AuthField id="new-password" label="New password">
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="new-password"
                className={`${authInputClass} pr-9`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-1 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e10600] focus-visible:ring-offset-2"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
          </AuthField>

          <AuthField id="confirm-password" label="Confirm new password">
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
              className={authInputClass}
            />
          </AuthField>

          <AuthSubmitButton isLoading={isSubmitting} loadingLabel="Updating...">
            SET NEW PASSWORD
          </AuthSubmitButton>

          <div className="flex items-center justify-between">
            <AuthLinkButton
              onClick={() => {
                setStep('email');
                setNotice(null);
                setError(null);
              }}
            >
              Change email
            </AuthLinkButton>
            <AuthLinkButton onClick={handleResend} disabled={isSending || cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </AuthLinkButton>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-6">
          <AuthNotice tone="success">
            Your password has been changed. Any other devices signed in as you have been
            signed out.
          </AuthNotice>
          <button
            type="button"
            onClick={() => router.push('/auth/signin')}
            className="inline-flex w-full items-center justify-center rounded-md bg-[#e10600] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b80505] focus:outline-none focus:ring-2 focus:ring-[#e10600] focus:ring-offset-2"
          >
            GO TO SIGN IN
          </button>
        </div>
      )}

      {step !== 'done' && (
        <div className="mt-8 border-t border-slate-100 pt-5 text-center">
          <Link
            href="/auth/signin"
            className="rounded-sm text-sm font-semibold text-[#e10600] transition-colors hover:text-[#b80505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e10600] focus-visible:ring-offset-2"
          >
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
