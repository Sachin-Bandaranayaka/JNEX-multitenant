'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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

// Why the previous session ended, as set on the sign-out redirect. Anything
// else in the query string is ignored rather than echoed back to the page.
const REASON_MESSAGES: Record<string, string> = {
  idle: 'You were signed out because you were inactive for 2 hours. Please sign in again.',
  expired: 'Your session has expired. Please sign in again.',
};

type Method = 'password' | 'code';

function friendlyError(error: string | null | undefined, fallback: string) {
  // NextAuth reports a rejected credential as the opaque "CredentialsSignin";
  // anything else is a message our own authorize() chose to surface.
  return !error || error === 'CredentialsSignin' ? fallback : error;
}

export function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const endedReason = REASON_MESSAGES[searchParams.get('reason') || ''];

  const [method, setMethod] = useState<Method>('password');
  const [codeSent, setCodeSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { requestCode, isSending, cooldown } = useCodeRequest('LOGIN');

  const switchMethod = (next: Method) => {
    setMethod(next);
    setError(null);
    setNotice(null);
    setCode('');
    setCodeSent(false);
  };

  const handlePasswordSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn('credentials', { email, password, redirect: false });

    if (result?.error) {
      setError(friendlyError(result.error, 'Invalid email or password.'));
      setIsLoading(false);
      return;
    }

    router.push(callbackUrl);
  };

  const handleSendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const result = await requestCode(email);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCodeSent(true);
    setNotice(result.message);
  };

  const handleCodeSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn('email-code', { email, code, redirect: false });

    if (result?.error) {
      setError(friendlyError(result.error, 'That code is not correct.'));
      setCode('');
      setIsLoading(false);
      return;
    }

    router.push(callbackUrl);
  };

  const handleResend = async () => {
    setError(null);
    const result = await requestCode(email);
    setNotice(result.ok ? 'A new code is on its way.' : null);
    if (!result.ok) setError(result.message);
    setCode('');
  };

  return (
    <AuthLayout>
      <h1 className="mb-8 text-center text-2xl font-semibold text-slate-700">
        Login to Your Account
      </h1>

      {endedReason && !error && <AuthNotice tone="info">{endedReason}</AuthNotice>}
      {error && <AuthNotice tone="error">{error}</AuthNotice>}
      {notice && !error && <AuthNotice tone="success">{notice}</AuthNotice>}

      {method === 'password' && (
        <form onSubmit={handlePasswordSignIn} className="space-y-6">
          <AuthField id="email" label="Email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
              className={authInputClass}
            />
          </AuthField>

          <AuthField id="password" label="Password">
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
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
          </AuthField>

          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="rounded-sm text-sm font-semibold text-[#e10600] transition-colors hover:text-[#b80505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e10600] focus-visible:ring-offset-2"
            >
              Forgot your password?
            </Link>
          </div>

          <AuthSubmitButton isLoading={isLoading} loadingLabel="Signing in...">
            SIGN IN
          </AuthSubmitButton>
        </form>
      )}

      {method === 'code' && !codeSent && (
        <form onSubmit={handleSendCode} className="space-y-6">
          <p className="text-sm leading-relaxed text-slate-500">
            We&apos;ll email you a {AUTH_CODE_TTL_MINUTES}-minute code. No password needed.
          </p>
          <AuthField id="code-email" label="Email">
            <input
              id="code-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
              className={authInputClass}
            />
          </AuthField>
          <AuthSubmitButton isLoading={isSending} loadingLabel="Sending...">
            EMAIL ME A CODE
          </AuthSubmitButton>
        </form>
      )}

      {method === 'code' && codeSent && (
        <form onSubmit={handleCodeSignIn} className="space-y-6">
          <p className="text-sm leading-relaxed text-slate-500">
            Enter the code we sent to <span className="font-semibold text-slate-700">{email}</span>.
          </p>
          <AuthField id="signin-code" label="6-digit code">
            <AuthCodeInput id="signin-code" value={code} onChange={setCode} autoFocus />
          </AuthField>

          <AuthSubmitButton isLoading={isLoading} loadingLabel="Verifying...">
            SIGN IN
          </AuthSubmitButton>

          <div className="flex items-center justify-between">
            <AuthLinkButton onClick={() => setCodeSent(false)}>Change email</AuthLinkButton>
            <AuthLinkButton onClick={handleResend} disabled={isSending || cooldown > 0}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </AuthLinkButton>
          </div>
        </form>
      )}

      <div className="mt-8 border-t border-slate-100 pt-5 text-center">
        {method === 'password' ? (
          <AuthLinkButton onClick={() => switchMethod('code')}>
            Sign in with an email code instead
          </AuthLinkButton>
        ) : (
          <AuthLinkButton onClick={() => switchMethod('password')}>
            Sign in with your password instead
          </AuthLinkButton>
        )}
      </div>

      <p className="mt-8 px-2 text-center text-xs leading-relaxed text-slate-600">
        Seamless shopping, reliable shipping &ndash; satisfaction to your doorstep with our
        innovative sales system!
      </p>
    </AuthLayout>
  );
}
