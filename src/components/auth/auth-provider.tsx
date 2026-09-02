'use client';

import { SessionProvider } from 'next-auth/react';
import { IdleTimeoutGuard } from './idle-timeout-guard';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    // Automatic refetching is off on purpose. Every session fetch re-mints the
    // JWT with a fresh two-hour expiry, so a periodic or focus-triggered
    // refetch would quietly defeat the idle timeout -- an unattended machine
    // would stay signed in indefinitely. IdleTimeoutGuard refreshes the session
    // instead, and only in response to real interaction.
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <IdleTimeoutGuard />
      {children}
    </SessionProvider>
  );
}
