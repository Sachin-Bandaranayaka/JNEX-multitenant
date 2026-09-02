// src/lib/auth-codes.ts
//
// Issuing and redeeming the six-digit codes we email for passwordless sign-in
// and for password resets.
//
// Three rules shape everything here:
//   1. Nothing in this module tells the caller whether an account exists. The
//      request endpoints answer identically either way, so the sign-in page
//      cannot be used to enumerate our customers' email addresses.
//   2. Codes are stored hashed, are single-use, expire quickly, and die after
//      a handful of wrong guesses -- a six-digit code is only strong enough if
//      guessing is rationed.
//   3. Issuing is rate limited per address, so nobody can use us to spam an
//      inbox (or burn through the email quota).

import { randomInt } from 'crypto';
import { compare, hash } from 'bcryptjs';
import { AuthCodePurpose } from '@prisma/client';
import { prisma } from './prisma';
import { AUTH_CODE_LENGTH, AUTH_CODE_TTL_MINUTES } from './auth-codes-shared';

export { AUTH_CODE_LENGTH, AUTH_CODE_TTL_MINUTES };
export const AUTH_CODE_MAX_ATTEMPTS = 5;
/// At most this many codes per address per window, across both purposes.
export const AUTH_CODE_REQUEST_WINDOW_MINUTES = 15;
export const AUTH_CODE_MAX_REQUESTS_PER_WINDOW = 5;

export type RequestIdentity = { ipAddress?: string | null; userAgent?: string | null };

export type ConsumeFailure = 'INVALID' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS';
export type ConsumeResult = { ok: true } | { ok: false; reason: ConsumeFailure };

/// Emails are matched case-insensitively -- people type their address with a
/// capital first letter far too often for that to be a login failure -- but
/// every code is filed under the address exactly as it is stored on the user,
/// so lookups on redemption line up with lookups on issue.
export async function findUserForAuthCode(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return null;
  return prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: 'insensitive' } },
    include: { tenant: { select: { isActive: true } } },
  });
}

function generateCode() {
  const max = 10 ** AUTH_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(AUTH_CODE_LENGTH, '0');
}

export function isWellFormedCode(code: string) {
  return new RegExp(`^\\d{${AUTH_CODE_LENGTH}}$`).test(code.trim());
}

/// Returns the plaintext code to email, or null when the address has asked too
/// often. Callers must not vary their response based on which one they get.
export async function issueAuthCode(
  email: string,
  purpose: AuthCodePurpose,
  identity: RequestIdentity = {},
): Promise<string | null> {
  const windowStart = new Date(Date.now() - AUTH_CODE_REQUEST_WINDOW_MINUTES * 60 * 1000);
  const recentRequests = await prisma.authCode.count({
    where: { email, createdAt: { gte: windowStart } },
  });
  if (recentRequests >= AUTH_CODE_MAX_REQUESTS_PER_WINDOW) return null;

  const code = generateCode();
  const codeHash = await hash(code, 10);
  const now = new Date();

  await prisma.$transaction([
    // Asking for a new code retires the old one, so an intercepted earlier
    // email is worthless the moment the user clicks "resend".
    prisma.authCode.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: now },
    }),
    prisma.authCode.create({
      data: {
        email,
        purpose,
        codeHash,
        expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_MINUTES * 60 * 1000),
        ipAddress: identity.ipAddress ?? null,
        userAgent: identity.userAgent ?? null,
      },
    }),
  ]);

  // Opportunistic housekeeping: spent codes are of no further use to anyone.
  const staleBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  prisma.authCode
    .deleteMany({ where: { expiresAt: { lt: staleBefore } } })
    .catch((error) => console.error('Failed to prune expired auth codes:', error));

  return code;
}

/// Checks a submitted code and, on success, burns it. A code is only ever good
/// for one thing, once.
export async function consumeAuthCode(
  email: string,
  purpose: AuthCodePurpose,
  code: string,
): Promise<ConsumeResult> {
  const submitted = code.trim();
  if (!isWellFormedCode(submitted)) return { ok: false, reason: 'INVALID' };

  const record = await prisma.authCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return { ok: false, reason: 'INVALID' };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'EXPIRED' };

  if (!(await compare(submitted, record.codeHash))) {
    const { attempts } = await prisma.authCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    if (attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await prisma.authCode.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    }
    return { ok: false, reason: 'INVALID' };
  }

  // Claim it conditionally: two requests racing with the same correct code
  // must not both succeed.
  const claimed = await prisma.authCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (!claimed.count) return { ok: false, reason: 'INVALID' };

  return { ok: true };
}

export function describeConsumeFailure(reason: ConsumeFailure) {
  switch (reason) {
    case 'EXPIRED':
      return 'That code has expired. Request a new one.';
    case 'TOO_MANY_ATTEMPTS':
      return 'Too many incorrect attempts. Request a new code.';
    default:
      return 'That code is not correct.';
  }
}

export { AuthCodePurpose };
