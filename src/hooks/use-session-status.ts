// src/hooks/use-session-status.ts

'use client';

import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";
import { signInUrlWithReason } from "@/lib/session-policy";

export function useSessionStatus() {
  const { data: session, status } = useSession();

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

  }, [status]); // Rerun this effect if the authentication status changes
}