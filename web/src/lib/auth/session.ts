import "server-only";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// Single-device session enforcement, ported from ApplicationUser.CurrentSessionId +
// Program.cs's OnValidatePrincipal + SessionClaimsPrincipalFactory.cs (see migration
// 0009_single_device_session.sql's comment for the full original-vs-port mapping).

export const SESSION_COOKIE = "wos_session_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — matches the auth session's own cookie lifetime.

/**
 * Stamps a fresh session id onto both the user's profile row and this device's cookie, and
 * revokes every other Supabase Auth session for this account. Call this right after a
 * sign-in actually completes (customer password login, admin OTP verification) — not on every
 * request, only when a new session begins.
 */
export async function completeSignIn(userId: string, accessToken: string): Promise<void> {
  const sessionId = randomUUID().replace(/-/g, "");

  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = { current_session_id: sessionId };
  await admin.from("profiles").update(patch).eq("id", userId);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  // Revoke every other active session for this account — "signing in on your phone signs you
  // out on your laptop." This call needs the NEW session's own access token (Supabase's admin
  // signOut API takes a JWT, not a user id), which is why this only works right after a sign-in,
  // not from an arbitrary server context.
  await admin.auth.admin.signOut(accessToken, "others");
}

/**
 * Rotates the stamped session id without touching any cookie, so whichever device is currently
 * signed in in as this user gets rejected on its very next request — used when an admin blocks a
 * customer, mirroring UsersController.cs's force-logout-other-devices behavior on block.
 */
export async function invalidateAllSessions(userId: string): Promise<void> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {
    current_session_id: randomUUID().replace(/-/g, ""),
  };
  await admin.from("profiles").update(patch).eq("id", userId);
}
