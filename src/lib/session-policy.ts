// src/lib/session-policy.ts
//
// One source of truth for how long a signed-in session survives without the
// user doing anything. Imported by both the NextAuth config (which enforces it
// on the server, by way of the JWT's own expiry) and the client-side idle
// guard (which does the warning and the tidy sign-out).

/// Two hours of no interaction and the session is gone, the way banking
/// portals behave. Because this is the JWT's `maxAge`, an idle tab cannot talk
/// its way back in: the cookie is simply no longer valid.
export const SESSION_IDLE_TIMEOUT_SECONDS = 2 * 60 * 60;
export const SESSION_IDLE_TIMEOUT_MS = SESSION_IDLE_TIMEOUT_SECONDS * 1000;

/// How long the "you're about to be signed out" dialog is on screen before the
/// sign-out actually happens.
export const SESSION_IDLE_WARNING_MS = 60 * 1000;

/// Real interaction extends the session by re-minting the JWT, but doing that
/// on every mouse move would be absurd, so it is throttled to this interval.
/// Must stay comfortably below the idle timeout.
export const SESSION_KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;

/// Sign-out reasons the sign-in page knows how to explain.
export const SESSION_ENDED_REASONS = {
  idle: 'idle',
  expired: 'expired',
} as const;

export type SessionEndedReason = keyof typeof SESSION_ENDED_REASONS;

export function signInUrlWithReason(reason: SessionEndedReason) {
  return `/auth/signin?reason=${SESSION_ENDED_REASONS[reason]}`;
}
