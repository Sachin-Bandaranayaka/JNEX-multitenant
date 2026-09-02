// src/app/api/auth/code/request/route.ts
//
// Asks for a six-digit code by email, either to sign in without a password or
// to reset a forgotten one.
//
// The response is deliberately the same whether or not the address belongs to
// an account: an unauthenticated endpoint that distinguishes the two is a
// customer-list export waiting to happen.

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { AuthCodePurpose } from '@prisma/client';
import {
  AUTH_CODE_TTL_MINUTES,
  findUserForAuthCode,
  issueAuthCode,
} from '@/lib/auth-codes';
import { getRequestIdentity } from '@/lib/impersonation';
import { isEmailConfigured, sendSecurityCodeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  email: z.string().trim().email().max(254),
  purpose: z.nativeEnum(AuthCodePurpose),
});

// What every caller sees, whatever actually happened behind it.
const GENERIC_OK = {
  ok: true,
  message: `If that email belongs to an account, a ${AUTH_CODE_TTL_MINUTES}-minute code is on its way.`,
};

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = RequestSchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const { email, purpose } = parsed.data;
  const identity = getRequestIdentity(await headers());

  try {
    const user = await findUserForAuthCode(email);

    // Deactivated users and users of suspended tenants are treated exactly
    // like strangers -- a code that cannot produce a session is worse than no
    // code at all, because it makes the account look reachable.
    const eligible =
      user && user.isActive && (user.role === 'SUPER_ADMIN' || user.tenant.isActive);
    if (!eligible) return NextResponse.json(GENERIC_OK);

    // Codes are filed under the stored address, so redemption looks them up
    // the same way no matter how the user capitalised their typing.
    const code = await issueAuthCode(user.email, purpose, identity);
    // Throttled. Still nothing to report: saying "too many requests" for real
    // addresses only would give the enumeration away.
    if (!code) return NextResponse.json(GENERIC_OK);

    if (!isEmailConfigured() && process.env.NODE_ENV !== 'production') {
      // Local development with no mail transport: the code goes to the server
      // log so the flow stays testable. In production this branch is not taken
      // and the send below throws instead, because silently "sending" a code
      // nobody receives locks the user out with no explanation.
      console.warn(`[auth-code] No email transport configured. ${purpose} code for ${user.email}: ${code}`);
      return NextResponse.json(GENERIC_OK);
    }

    await sendSecurityCodeEmail({
      to: user.email,
      name: user.name,
      code,
      purpose,
      expiresInMinutes: AUTH_CODE_TTL_MINUTES,
    });

    return NextResponse.json(GENERIC_OK);
  } catch (error) {
    console.error('Failed to issue auth code:', error);
    return NextResponse.json(
      { error: 'We could not send the code right now. Please try again in a moment.' },
      { status: 502 },
    );
  }
}
