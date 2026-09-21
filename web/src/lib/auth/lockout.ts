import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, ADMIN_LOCKOUT_MINUTES } from "@/lib/auth/constants";
import type { Database } from "@/types/database";

// Supabase Auth has no built-in "N failed attempts -> locked for M minutes" policy like ASP.NET
// Identity did, so it's tracked in public.login_lockouts (keyed by email, not user id — the
// admin API has no "get user by email" lookup, and the check must run BEFORE
// signInWithPassword() so a locked account's password is never even checked) and enforced here.
// Ported from AccountController.Login / Areas/Admin/Controllers/AuthController.Login.

type LockoutRow = Database["public"]["Tables"]["login_lockouts"]["Row"];

export interface LockoutCheck {
  locked: boolean;
  minutesRemaining: number;
  /** True when the block is far longer than an ordinary timeout — an admin-issued block. */
  isAdminBlock: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Looks up lockout state by email and reports whether it is currently locked. */
export async function checkLockout(email: string): Promise<LockoutCheck> {
  const admin = createAdminClient();
  const result = await admin
    .from("login_lockouts")
    .select("email, failed_login_attempts, locked_until")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  const row = result.data as Pick<LockoutRow, "email" | "failed_login_attempts" | "locked_until"> | null;

  if (!row?.locked_until) return { locked: false, minutesRemaining: 0, isAdminBlock: false };

  const until = new Date(row.locked_until).getTime();
  const now = Date.now();
  if (until <= now) return { locked: false, minutesRemaining: 0, isAdminBlock: false };

  const minutesRemaining = Math.ceil((until - now) / 60000);
  // A block set for more than a day out is treated as admin-issued rather than an ordinary
  // too-many-attempts timeout, so the message doesn't wrongly promise it will lift shortly.
  const isAdminBlock = until - now > 24 * 60 * 60 * 1000;

  return { locked: true, minutesRemaining, isAdminBlock };
}

/** Records one failed password attempt and locks the account if the threshold is crossed. */
export async function recordFailedAttempt(
  email: string,
  isAdmin: boolean
): Promise<{ justLocked: boolean; minutes: number }> {
  const admin = createAdminClient();
  const normalized = normalizeEmail(email);

  const existingResult = await admin
    .from("login_lockouts")
    .select("failed_login_attempts")
    .eq("email", normalized)
    .maybeSingle();
  const existing = existingResult.data as Pick<LockoutRow, "failed_login_attempts"> | null;

  const attempts = (existing?.failed_login_attempts ?? 0) + 1;
  const minutes = isAdmin ? ADMIN_LOCKOUT_MINUTES : LOCKOUT_MINUTES;

  const lockedUntil = attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + minutes * 60000).toISOString() : null;

  const upsert: Database["public"]["Tables"]["login_lockouts"]["Insert"] = {
    email: normalized,
    failed_login_attempts: attempts,
    locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  };
  await admin.from("login_lockouts").upsert(upsert, { onConflict: "email" });

  return attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? { justLocked: true, minutes } : { justLocked: false, minutes: 0 };
}

/** Clears the failure count and any lock — called after a successful sign-in. */
export async function recordSuccessfulLogin(email: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("login_lockouts").delete().eq("email", normalizeEmail(email));
}

/** Admin-issued block: locked far enough out that checkLockout() reports it as isAdminBlock. */
export async function setAdminBlock(email: string, minutes = ADMIN_LOCKOUT_MINUTES): Promise<void> {
  const admin = createAdminClient();
  const normalized = normalizeEmail(email);
  const upsert: Database["public"]["Tables"]["login_lockouts"]["Insert"] = {
    email: normalized,
    locked_until: new Date(Date.now() + minutes * 60000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await admin.from("login_lockouts").upsert(upsert, { onConflict: "email" });
}
