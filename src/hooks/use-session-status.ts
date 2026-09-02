// src/hooks/use-session-status.ts

'use client';

import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";
import { signInUrlWithReason } from "@/lib/session-policy";

export function useSessionStatus() {
  const { data: session, status, update } = useSession();

  useEffect(() => {
    if (status !== "authenticated") {
      return; // Don't do anything if not authenticated
    }

    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session-status');
        const data = await response.json();

        if (!data.active) {
          await signOut({ callbackUrl: signInUrlWithReason('expired') });
          return;
        }

        // The signed-in cookie no longer matches this user's access. Refreshing
        // the session re-mints the JWT, so the sidebar, the pages and the
        // middleware all start honouring the new permissions without the user
        // having to sign out and back in.
        if (data.stale) {
          await update();
        }
      } catch (error) {
        console.error("Failed to check session status:", error);
      }
    };

    // Check immediately when the component mounts
    checkSession();

    // Then, check every 60 seconds
    const interval = setInterval(checkSession, 60 * 1000);

    // Clean up the interval when the component unmounts
    return () => clearInterval(interval);

    // `update` is stable for the lifetime of the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]); // Rerun this effect if the authentication status changes
}
