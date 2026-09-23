import "server-only";
import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVisitorIp, getGeoLocation, locationLabel } from "@/lib/data/visitor";
import { parseUserAgent } from "@/lib/auth/device-info";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyNewSignIn } from "@/lib/email/service";
import { formatDateTime } from "@/lib/utils/format";
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

  // New-sign-in security email — fire-and-forget, never let a slow/failed notification block or
  // fail the actual sign-in itself.
  void notifySignInEvent(userId).catch((err) => console.error("Failed to send new-sign-in email:", err));
}

async function notifySignInEvent(userId: string): Promise<void> {
  const admin = createAdminClient();
  const [userResult, profileResult, site, h] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    getSiteSettingsPublic(),
    headers(),
  ]);

  const email = userResult.data.user?.email;
  if (!email) return;

  const fullName = (profileResult.data as { full_name: string } | null)?.full_name || "there";
  const ip = await getVisitorIp();
  const geo = await getGeoLocation(ip, site.feature_geolocation);
  const { browser, os, deviceType } = parseUserAgent(h.get("user-agent"));

  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await notifyNewSignIn(toEmailConfig(site, siteBaseUrl), email, {
    fullName,
    ipAddress: ip,
    location: geo ? locationLabel(geo) : "Unknown location",
    browser,
    os,
    deviceType,
    signedInAt: formatDateTime(new Date()),
  });
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
