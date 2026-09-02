// src/app/api/auth/password/reset/route.ts
//
// Completes a forgotten-password reset: email + emailed code + new password,
// in one call. There is no intermediate token to leak into a URL, browser
// history or a referrer header -- proving control of the inbox and choosing the
// new password happen in the same request.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { AuthCodePurpose } from '@prisma/client';
import { consumeAuthCode, describeConsumeFailure, findUserForAuthCode } from '@/lib/auth-codes';
import { getRequestIdentity } from '@/lib/impersonation';
import { prisma } from '@/lib/prisma';
import { validatePassword } from '@/lib/password-policy';

export const dynamic = 'force-dynamic';

const ResetSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().trim(),
  password: z.string().min(1).max(200),
});

// One message for every "the code did not work" case that could otherwise be
// used to probe which addresses exist.
const REJECTED = 'That code is not valid. Request a new one and try again.';

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = ResetSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { email, code, password } = parsed.data;

  const passwordProblem = validatePassword(password);
  if (passwordProblem) {
    return NextResponse.json({ error: passwordProblem }, { status: 400 });
  }

  try {
    const user = await findUserForAuthCode(email);
    const eligible =
      user && user.isActive && (user.role === 'SUPER_ADMIN' || user.tenant.isActive);
    if (!eligible) return NextResponse.json({ error: REJECTED }, { status: 400 });

    const result = await consumeAuthCode(user.email, AuthCodePurpose.PASSWORD_RESET, code);
    if (!result.ok) {
      return NextResponse.json({ error: describeConsumeFailure(result.reason) }, { status: 400 });
    }

    const identity = getRequestIdentity(await headers());
    const hashedPassword = await hash(password, 12);

    await resetPassword(user.id, user.tenantId, user.email, hashedPassword, identity);

    return NextResponse.json({
      ok: true,
      message: 'Your password has been reset. You can sign in with it now.',
    });
  } catch (error) {
    console.error('Password reset failed:', error);
    return NextResponse.json(
      { error: 'We could not reset your password right now. Please try again.' },
      { status: 500 },
    );
  }
}

async function resetPassword(
  userId: string,
  tenantId: string,
  email: string,
  hashedPassword: string,
  identity: { ipAddress: string | null; userAgent: string | null },
) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      // passwordChangedAt is what actually evicts anyone still holding a
      // session that was minted with the old password -- see the session-status
      // poll, which compares it against when the session was issued.
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // A reset also retires any sign-in code that is still outstanding for this
    // address, so a code phished before the reset cannot be spent after it.
    await tx.authCode.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    await tx.auditEvent.create({
      data: {
        actorId: userId,
        tenantId,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: userId,
        metadata: { method: 'EMAIL_CODE' },
        ...identity,
      },
    });
  });
}
