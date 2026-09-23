"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

// New security feature (not a port — the original used a 14-day sliding session with no idle
// timeout at all, see Program.cs's ExpireTimeSpan/SlidingExpiration). Signs a customer or admin
// out automatically after IDLE_MINUTES of no mouse/keyboard/touch/scroll activity, regardless of
// how much time is left on the underlying session cookie — a shared/public computer left
// unattended while signed in is a real risk this closes.
//
// Client-side only by design: the inactivity clock has to live in the browser (the server has no
// way to know "no activity happened" — every request it sees IS activity), so this can't be done
// in proxy.ts or a Server Action alone. It signs out via the same Server Actions the manual
// "Sign Out" button uses, just triggered by a timer instead of a click.

const IDLE_MINUTES = 20;
const IDLE_MS = IDLE_MINUTES * 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export function IdleLogout({
  isSignedIn,
  logoutAction,
  loginPath,
}: {
  isSignedIn: boolean;
  logoutAction: () => Promise<void>;
  loginPath: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const signOutForInactivity = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    startTransition(async () => {
      await logoutAction();
      const url = new URL(loginPath, window.location.origin);
      url.searchParams.set("reason", "idle");
      router.push(`${url.pathname}${url.search}`);
      router.refresh();
    });
  }, [logoutAction, loginPath, router]);

  useEffect(() => {
    if (!isSignedIn) return;

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(signOutForInactivity, IDLE_MS);
    }

    resetTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [isSignedIn, signOutForInactivity]);

  return null;
}
