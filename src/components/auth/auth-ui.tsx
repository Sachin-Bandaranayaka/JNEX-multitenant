'use client';

// Small shared pieces for the unauthenticated screens, so the sign-in form,
// the email-code step and the password reset stay visually identical.

import { Loader2 } from 'lucide-react';
import { AUTH_CODE_LENGTH } from '@/lib/auth-codes-shared';

export function AuthNotice({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success';
  children: React.ReactNode;
}) {
  const palette = {
    error: 'bg-[#fdeceb] text-[#c9453f] border-[#f0c2bd]',
    info: 'bg-[#fff8e8] text-[#8a6412] border-[#f2dfae]',
    success: 'bg-[#eaf7ee] text-[#1f7a3f] border-[#bfe3ca]',
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mb-5 flex items-start gap-2 rounded-md border p-3 text-sm font-medium ${palette}`}
    >
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-current" />
      <span>{children}</span>
    </div>
  );
}

export function AuthField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

export const authInputClass =
  'w-full border-0 border-b-2 border-[#e3e6ea] bg-transparent py-2 text-slate-700 transition-colors focus:border-[#e10600] focus:outline-none focus:ring-0';

export function AuthSubmitButton({
  isLoading,
  children,
  loadingLabel,
}: {
  isLoading: boolean;
  children: React.ReactNode;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#e10600] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b80505] focus:outline-none focus:ring-2 focus:ring-[#e10600] focus:ring-offset-2 disabled:opacity-60"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthLinkButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-sm text-sm font-semibold text-[#e10600] transition-colors hover:text-[#b80505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e10600] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
    >
      {children}
    </button>
  );
}

/// The six-digit box. Wide letter spacing and a numeric keypad on mobile,
/// because this is the one field people retype from another app.
export function AuthCodeInput({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      id={id}
      name={id}
      value={value}
      // Strip anything that is not a digit so a pasted "123 456" still works.
      onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, AUTH_CODE_LENGTH))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={`\\d{${AUTH_CODE_LENGTH}}`}
      maxLength={AUTH_CODE_LENGTH}
      required
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the whole screen is this one field
      autoFocus={autoFocus}
      placeholder="000000"
      className={`${authInputClass} text-center text-2xl font-bold tracking-[0.5em] placeholder:text-slate-200`}
    />
  );
}
