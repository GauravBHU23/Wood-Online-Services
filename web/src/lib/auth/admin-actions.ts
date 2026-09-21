"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/utils/client-ip";
import { checkLockout, recordFailedAttempt, recordSuccessfulLogin, setAdminBlock } from "@/lib/auth/lockout";
import * as suspiciousActivity from "@/lib/auth/suspicious-activity";
import { ADMIN_LOCKOUT_MINUTES } from "@/lib/auth/constants";
import { issueAdminOtp, verifyAdminOtp, getOtpUserId } from "@/lib/auth/admin-otp";
import { loginSchema, verifyOtpSchema, type LoginInput, type VerifyOtpInput } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/auth/types";

// Ported from Areas/Admin/Controllers/AuthController.cs. Admin sign-in is entirely separate
// from the customer form: a different password check that rejects any non-Admin account
// outright, and a mandatory email OTP second factor that customers never see.

export interface AdminLoginResult extends ActionResult {
  otpToken?: string;
}

export async function adminLoginAction(input: LoginInput): Promise<AdminLoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email, password } = parsed.data;
  const ip = await getClientIp();

  if (suspiciousActivity.isBlocked(ip)) {
    return {
      success: false,
      message: `Too many sign-in attempts from your network. Please try again in ${suspiciousActivity.minutesRemaining(ip)} minutes.`,
    };
  }

  const lockout = await checkLockout(email);
  if (lockout.locked) {
    return {
      success: false,
      message: lockout.isAdminBlock
        ? "This account has been blocked. Please contact us if you believe this is a mistake."
        : `Too many failed attempts. This account is locked for ${lockout.minutesRemaining} minutes.`,
    };
  }

  // Verify the password without keeping the session signed in yet — sign out immediately after,
  // OTP verification is what actually completes the sign-in.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    suspiciousActivity.recordFailedAttempt(ip, ADMIN_LOCKOUT_MINUTES);
    const result = await recordFailedAttempt(email, true);
    if (result.justLocked) {
      return {
        success: false,
        message: `Too many failed attempts. This account is locked for ${result.minutes} minutes.`,
      };
    }
    return { success: false, message: "Incorrect email or password." };
  }

  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("role, full_name").eq("id", data.user.id).maybeSingle();
  const profile = profileResult.data as { role: "customer" | "admin"; full_name: string } | null;

  await supabase.auth.signOut();

  if (profile?.role !== "admin") {
    return { success: false, message: "This sign-in page is for administrators only." };
  }

  suspiciousActivity.recordSuccess(ip);
  await recordSuccessfulLogin(email);

  const otpToken = await issueAdminOtp(data.user.id, email, profile.full_name);

  return {
    success: true,
    message: "We emailed you a 6-digit code. Enter it below to finish signing in.",
    otpToken,
  };
}

export async function adminVerifyOtpAction(input: VerifyOtpInput): Promise<ActionResult> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { token, code } = parsed.data;

  const verifyResult = await verifyAdminOtp(token, code);

  const messages: Record<typeof verifyResult, string | null> = {
    success: null,
    invalid_code: "That code is incorrect. Please try again.",
    expired: "That code has expired. Please sign in again to get a new one.",
    too_many_attempts: "Too many incorrect attempts. Please sign in again to get a new code.",
    not_found: "That code is no longer valid. Please sign in again.",
  };

  if (verifyResult !== "success") {
    return { success: false, message: messages[verifyResult]! };
  }

  const userId = await getOtpUserId(token);
  if (!userId) {
    return { success: false, message: "That code is no longer valid. Please sign in again." };
  }

  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("role, must_change_password, full_name").eq("id", userId).maybeSingle();
  const profile = profileResult.data as { role: "customer" | "admin"; must_change_password: boolean; full_name: string } | null;

  if (!profile || profile.role !== "admin") {
    return { success: false, message: "That code is no longer valid. Please sign in again." };
  }

  // Complete the actual sign-in now that the OTP has been verified. generateLink + verifyOtp is
  // the supported server-side way to mint a real session for a specific user without their
  // password (we already verified it once in adminLoginAction).
  const userResult = await admin.auth.admin.getUserById(userId);
  const email = userResult.data.user?.email;
  if (!email) {
    return { success: false, message: "That code is no longer valid. Please sign in again." };
  }

  const linkResult = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkResult.error || !linkResult.data.properties?.hashed_token) {
    return { success: false, message: "Could not complete sign-in. Please try again." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkResult.data.properties.hashed_token,
  });

  if (verifyError) {
    return { success: false, message: "Could not complete sign-in. Please try again." };
  }

  if (profile.must_change_password) {
    return { success: true, message: "For security, you must set a new password before continuing." };
  }

  return { success: true, message: `Welcome back, ${profile.full_name}!` };
}

export async function adminResendOtpAction(token: string) {
  const { resendAdminOtp } = await import("@/lib/auth/admin-otp");
  return resendAdminOtp(token);
}

export async function adminLogoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export { setAdminBlock };
