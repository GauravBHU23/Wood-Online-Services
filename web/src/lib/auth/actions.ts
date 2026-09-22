"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeGuestCartIntoUser } from "@/lib/data/cart";
import { getClientIp } from "@/lib/utils/client-ip";
import { registerSchema, loginSchema, type RegisterInput, type LoginInput } from "@/lib/validation/schemas";
import { checkLockout, recordFailedAttempt, recordSuccessfulLogin } from "@/lib/auth/lockout";
import * as suspiciousActivity from "@/lib/auth/suspicious-activity";
import { LOCKOUT_MINUTES } from "@/lib/auth/constants";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyWelcome } from "@/lib/email/service";
import type { Database } from "@/types/database";
import type { ActionResult } from "@/lib/auth/types";

// Ported from Controllers/AccountController.cs. Supabase Auth (auth.users) replaces ASP.NET
// Identity; per-account lockout and credential-stuffing IP tracking are re-implemented here
// (see lib/auth/lockout.ts and lib/auth/suspicious-activity.ts) since Supabase Auth has no
// built-in equivalent of either.

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  const limited = await enforceSensitiveRateLimit();
  if (limited) return limited;

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { fullName, email, phoneNumber, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName.trim() } },
  });

  if (error) {
    // Supabase reports a duplicate email as a generic "already registered" error, or via
    // identities being empty on a successful-looking signUp response for an existing address.
    if (error.message.toLowerCase().includes("already registered") || error.status === 422) {
      return { success: false, message: "An account with this email already exists. Please sign in instead." };
    }
    if (error.message.toLowerCase().includes("password")) {
      return { success: false, message: "Password must be at least 8 characters long." };
    }
    return { success: false, message: error.message };
  }

  const user = data.user;
  if (!user) {
    return { success: false, message: "Could not create your account. Please try again." };
  }

  // Supabase can return a user with an empty identities array when the email is already taken
  // but email confirmation is enabled — treat it the same as the duplicate-email error above.
  if (user.identities && user.identities.length === 0) {
    return { success: false, message: "An account with this email already exists. Please sign in instead." };
  }

  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {
    full_name: fullName.trim(),
  };
  await admin.from("profiles").update(patch).eq("id", user.id);
  // Phone isn't part of the profiles table (auth.users.phone is a separate Supabase Auth
  // concept normally used for SMS OTP); store it via user metadata instead so it round-trips.
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: fullName.trim(), phone: phoneNumber },
  });

  await mergeGuestCartIntoUser(user.id);

  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await notifyWelcome(toEmailConfig(site, siteBaseUrl), email, fullName.trim());

  revalidatePath("/", "layout");
  return { success: true, message: `Welcome, ${fullName.trim()}! Your account is ready.` };
}

export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const limited = await enforceSensitiveRateLimit();
  if (limited) return limited;

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email, password } = parsed.data;

  const ip = await getClientIp();

  // Catches credential stuffing that per-account lockout misses: many failed attempts from one
  // IP, each against a different email, never trips any single account's limit.
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
        : `Too many failed attempts. Your account is locked for ${lockout.minutesRemaining} minutes.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    suspiciousActivity.recordFailedAttempt(ip, LOCKOUT_MINUTES);
    const result = await recordFailedAttempt(email, false);
    if (result.justLocked) {
      return {
        success: false,
        message: `Too many failed attempts. Your account is locked for ${result.minutes} minutes.`,
      };
    }
    // Deliberately vague so the form cannot be used to discover which emails are registered.
    return { success: false, message: "Incorrect email or password." };
  }

  // Reject an Admin account here — admins sign in from a separate page (with its own OTP step).
  const admin = createAdminClient();
  const profileResult = await admin
    .from("profiles")
    .select("role, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();
  const profile = profileResult.data as { role: "customer" | "admin"; must_change_password: boolean } | null;

  if (profile?.role === "admin") {
    await supabase.auth.signOut();
    return { success: false, message: "Admin accounts sign in from the admin sign-in page, not here." };
  }

  suspiciousActivity.recordSuccess(ip);
  await recordSuccessfulLogin(email);
  await mergeGuestCartIntoUser(data.user.id);

  revalidatePath("/", "layout");

  if (profile?.must_change_password) {
    return { success: true, message: "For security, you must set a new password before continuing." };
  }

  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? "";
  return { success: true, message: `Welcome back${fullName ? `, ${fullName}` : ""}!` };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
