// src/lib/password-policy.ts
//
// The rule a self-service password has to satisfy. Kept on its own so the
// reset flow, the sign-up paths and any future "change my password" screen all
// agree on what "strong enough" means.

export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RULE_TEXT =
  'At least 8 characters, including one letter and one number.';

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}
