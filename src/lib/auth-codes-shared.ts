// src/lib/auth-codes-shared.ts
//
// The handful of auth-code constants the browser needs. Kept apart from
// lib/auth-codes so that importing "how long is a code" into a client
// component does not drag Prisma and bcrypt into the bundle.

export const AUTH_CODE_LENGTH = 6;
export const AUTH_CODE_TTL_MINUTES = 10;
/// How long the "resend" button stays disabled after a code is sent.
export const AUTH_CODE_RESEND_COOLDOWN_SECONDS = 45;
