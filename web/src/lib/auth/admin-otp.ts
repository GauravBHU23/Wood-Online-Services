import "server-only";
import { randomUUID, randomInt, createHash, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdminOtp } from "@/lib/email/service";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import type { Database } from "@/types/database";

// Ported from Services/AdminOtpService.cs. Email-delivered one-time codes required to complete
// an admin sign-in — the second factor, checked after the password verifies but before the
// session actually signs in. The code itself is never stored at rest, only its SHA-256 hash.

const CODE_LENGTH = 6;
const LIFETIME_MINUTES = 10;
const RESEND_COOLDOWN_MINUTES = 3;
const MAX_ATTEMPTS = 5;

export type OtpVerifyResult = "success" | "invalid_code" | "expired" | "too_many_attempts" | "not_found";

type OtpRow = Database["public"]["Tables"]["admin_login_otps"]["Row"];

function hash(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function generateCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
}

/** Invalidates any existing code for this admin and issues a fresh 6-digit one, emailed to them. */
export async function issueAdminOtp(userId: string, email: string, fullName: string): Promise<string> {
  const admin = createAdminClient();

  // Only one code should ever be redeemable at a time.
  await admin.from("admin_login_otps").delete().eq("user_id", userId).eq("is_used", false);

  const code = generateCode();
  const publicToken = randomUUID();
  const expiresAt = new Date(Date.now() + LIFETIME_MINUTES * 60000).toISOString();

  const insert: Database["public"]["Tables"]["admin_login_otps"]["Insert"] = {
    public_token: publicToken,
    user_id: userId,
    code_hash: hash(code),
    expires_at: expiresAt,
  };
  await admin.from("admin_login_otps").insert(insert);

  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await notifyAdminOtp(toEmailConfig(site, siteBaseUrl), email, fullName, code, LIFETIME_MINUTES);

  return publicToken;
}

export async function verifyAdminOtp(publicToken: string, code: string): Promise<OtpVerifyResult> {
  const admin = createAdminClient();
  const result = await admin.from("admin_login_otps").select("*").eq("public_token", publicToken).maybeSingle();
  const otp = result.data as OtpRow | null;

  if (!otp || otp.is_used) return "not_found";
  if (otp.failed_attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (new Date() > new Date(otp.expires_at)) return "expired";

  const computed = Buffer.from(hash(code.trim()), "utf8");
  const stored = Buffer.from(otp.code_hash, "utf8");
  const matches = computed.length === stored.length && timingSafeEqual(computed, stored);

  if (!matches) {
    const attempts = otp.failed_attempts + 1;
    const patch: Database["public"]["Tables"]["admin_login_otps"]["Update"] = { failed_attempts: attempts };
    await admin.from("admin_login_otps").update(patch).eq("id", otp.id);
    return attempts >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid_code";
  }

  const patch: Database["public"]["Tables"]["admin_login_otps"]["Update"] = { is_used: true };
  await admin.from("admin_login_otps").update(patch).eq("id", otp.id);
  return "success";
}

/** Fetches the user_id behind a verified (used) OTP token, for completing sign-in. */
export async function getOtpUserId(publicToken: string): Promise<string | null> {
  const admin = createAdminClient();
  const result = await admin.from("admin_login_otps").select("user_id").eq("public_token", publicToken).maybeSingle();
  const row = result.data as Pick<OtpRow, "user_id"> | null;
  return row?.user_id ?? null;
}

export interface OtpResendResult {
  success: boolean;
  newToken: string | null;
  secondsUntilAllowed: number;
}

/** Re-sends a code for the same sign-in attempt, subject to the resend cooldown. */
export async function resendAdminOtp(publicToken: string): Promise<OtpResendResult> {
  const admin = createAdminClient();
  const result = await admin.from("admin_login_otps").select("*").eq("public_token", publicToken).maybeSingle();
  const otp = result.data as OtpRow | null;

  if (!otp || otp.is_used) return { success: false, newToken: null, secondsUntilAllowed: 0 };

  const elapsedMs = Date.now() - new Date(otp.created_at).getTime();
  const cooldownMs = RESEND_COOLDOWN_MINUTES * 60000;
  if (elapsedMs < cooldownMs) {
    return { success: false, newToken: null, secondsUntilAllowed: Math.ceil((cooldownMs - elapsedMs) / 1000) };
  }

  const userResult = await admin.auth.admin.getUserById(otp.user_id);
  const user = userResult.data.user;
  if (!user?.email) return { success: false, newToken: null, secondsUntilAllowed: 0 };

  const profileResult = await admin.from("profiles").select("full_name").eq("id", otp.user_id).maybeSingle();
  const fullName = (profileResult.data as { full_name: string } | null)?.full_name ?? "";

  const newToken = await issueAdminOtp(otp.user_id, user.email, fullName);
  return { success: true, newToken, secondsUntilAllowed: 0 };
}
