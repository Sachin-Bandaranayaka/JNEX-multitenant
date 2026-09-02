'use client';

// Banking-style idle expiry.
//
// The server is the one that actually enforces this: the JWT is minted with a
// two-hour life (see lib/session-policy), so an abandoned tab loses its
// credentials whether or not this component is running. What this component
// adds is the part a user experiences -- the session is extended when they are
// genuinely working, they get a minute's warning before they lose it, and they
// land on the sign-in page with an explanation instead of a silent bounce.
//
// "Genuinely working" matters: NextAuth re-mints the token on every session
// refresh, so a background poll would keep an unattended machine signed in
// forever. Refreshes are therefore driven from real input events only, and
// SessionProvider's own automatic refetching is switched off.

import { useCallback, useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_IDLE_WARNING_MS,
  SESSION_KEEPALIVE_INTERVAL_MS,
  signInUrlWithReason,
} from '@/lib/session-policy';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

// Shared across tabs: working in one tab must not let another tab's timer
// expire the session out from under it.
const LAST_ACTIVITY_KEY = 'jnex.session.last-activity';
const ACTIVITY_PERSIST_INTERVAL_MS = 15 * 1000;
const TICK_MS = 5 * 1000;

function readSharedActivity(): number | null {
  try {
    const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null; // Private mode, blocked storage: fall back to this tab only.
  }
}

function writeSharedActivity(at: number) {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    /* not fatal -- the in-memory timer still works */
  }
}

export function IdleTimeoutGuard() {
  const { status, update } = useSession();
  const [msLeft, setMsLeft] = useState<number | null>(null);

  const lastActivityRef = useRef(Date.now());
  const lastPersistedRef = useRef(0);
  const lastKeepAliveRef = useRef(Date.now());
  const signingOutRef = useRef(false);

  const registerActivity = useCallback(
    (at = Date.now()) => {
      if (at > lastActivityRef.current) lastActivityRef.current = at;

      if (at - lastPersistedRef.current >= ACTIVITY_PERSIST_INTERVAL_MS) {
        lastPersistedRef.current = at;
        writeSharedActivity(at);
      }

      // Extending the session means re-minting the JWT, which is a network
      // round trip -- so it happens on a slow cadence, not per keystroke.
      if (at - lastKeepAliveRef.current >= SESSION_KEEPALIVE_INTERVAL_MS) {
        lastKeepAliveRef.current = at;
        // No arguments: the jwt callback reads impersonation changes off the
        // update payload, and passing nothing leaves those claims untouched.
        void update();
      }
    },
    [update],
  );

  const endSession = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    await signOut({ callbackUrl: signInUrlWithReason('idle') });
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setMsLeft(null);
      return;
    }

    const now = Date.now();
    lastActivityRef.current = Math.max(readSharedActivity() ?? 0, now);
    lastKeepAliveRef.current = now;
    signingOutRef.current = false;

    const onActivity = () => registerActivity();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { passive: true }),
    );

    // Another tab reporting activity counts as activity here too.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_KEY || !event.newValue) return;
      const at = Number(event.newValue);
      if (Number.isFinite(at) && at > lastActivityRef.current) lastActivityRef.current = at;
    };
    window.addEventListener('storage', onStorage);

    const interval = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      const remaining = SESSION_IDLE_TIMEOUT_MS - idleFor;

      if (remaining <= 0) {
        setMsLeft(0);
        void endSession();
        return;
      }
      setMsLeft(remaining <= SESSION_IDLE_WARNING_MS ? remaining : null);
    }, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [status, registerActivity, endSession]);

  if (status !== 'authenticated' || msLeft === null) return null;

  const seconds = Math.max(0, Math.ceil(msLeft / 1000));

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      aria-describedby="idle-timeout-description"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-lg border border-red-100 bg-white p-6 shadow-xl">
        <h2 id="idle-timeout-title" className="text-lg font-semibold text-slate-800">
          Still there?
        </h2>
        <p id="idle-timeout-description" className="mt-2 text-sm leading-relaxed text-slate-600">
          You have been inactive for a while. For your security you will be signed
          out in{' '}
          <span className="font-semibold tabular-nums text-[#e10600]">{seconds}s</span>.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={() => {
              // Force the refresh: this is the one click that must extend the
              // session no matter when the last keep-alive happened.
              lastKeepAliveRef.current = 0;
              registerActivity();
              setMsLeft(null);
            }}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-[#e10600] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b80505] focus:outline-none focus:ring-2 focus:ring-[#e10600] focus:ring-offset-2"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
