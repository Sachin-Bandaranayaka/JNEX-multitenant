import { describe, expect, it } from 'vitest';
import { isWellFormedCode, describeConsumeFailure } from '../auth-codes';
import { validatePassword } from '../password-policy';

describe('isWellFormedCode', () => {
  it('accepts exactly six digits', () => {
    expect(isWellFormedCode('000000')).toBe(true);
    expect(isWellFormedCode('  123456  ')).toBe(true);
  });

  it('rejects anything that is not six digits', () => {
    expect(isWellFormedCode('12345')).toBe(false);
    expect(isWellFormedCode('1234567')).toBe(false);
    expect(isWellFormedCode('12345a')).toBe(false);
    expect(isWellFormedCode('')).toBe(false);
  });
});

describe('describeConsumeFailure', () => {
  it('never reveals whether the account exists', () => {
    const messages = (['INVALID', 'EXPIRED', 'TOO_MANY_ATTEMPTS'] as const).map(
      describeConsumeFailure,
    );
    for (const message of messages) {
      expect(message).not.toMatch(/account|user|email address/i);
    }
  });
});

describe('validatePassword', () => {
  it('accepts a password with the required length and mix', () => {
    expect(validatePassword('sunshine9')).toBeNull();
  });

  it('rejects short passwords', () => {
    expect(validatePassword('ab3')).toMatch(/at least 8/);
  });

  it('rejects passwords with no digit or no letter', () => {
    expect(validatePassword('sunshinelane')).toMatch(/letter and one number/);
    expect(validatePassword('123456789')).toMatch(/letter and one number/);
  });
});
