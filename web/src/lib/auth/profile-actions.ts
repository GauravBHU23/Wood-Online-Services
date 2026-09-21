"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  profileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  type ProfileInput,
  type ChangePasswordInput,
  type ForgotPasswordInput,
} from "@/lib/validation/schemas";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyPasswordReset } from "@/lib/email/service";
import type { ActionResult } from "@/lib/auth/types";
import type { Database } from "@/types/database";

// Ported from Controllers/AccountController.cs (Profile, ChangePassword, ForgotPassword).

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Please sign in again." };

  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["profiles"]["Update"] = {
    full_name: parsed.data.fullName.trim(),
    address: parsed.data.address?.trim() || null,
    city: parsed.data.city?.trim() || null,
    state: parsed.data.state?.trim() || null,
    pin_code: parsed.data.pinCode?.trim() || null,
  };
  await admin.from("profiles").update(patch).eq("id", user.id);
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, full_name: parsed.data.fullName.trim(), phone: parsed.data.phoneNumber },
  });

  revalidatePath("/account/profile");
  revalidatePath("/", "layout");
  return { success: true, message: "Your profile has been updated." };
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { success: false, message: "Please sign in again." };

  // Re-verify the current password first (updateUser alone doesn't require it).
  const verify = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.currentPassword });
  if (verify.error) {
    return { success: false, message: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    return { success: false, message: "Password must be at least 8 characters long." };
  }

  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("must_change_password, role").eq("id", user.id).maybeSingle();
  const profile = profileResult.data as { must_change_password: boolean; role: "customer" | "admin" } | null;

  const wasForced = profile?.must_change_password ?? false;
  if (wasForced) {
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = { must_change_password: false };
    await admin.from("profiles").update(patch).eq("id", user.id);
  }

  return {
    success: true,
    message: "Your password has been changed.",
    redirectToAdminDashboard: wasForced && profile?.role === "admin",
  };
}

export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please fix the errors below.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const admin = createAdminClient();
  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const linkResult = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email,
    options: { redirectTo: `${siteBaseUrl}/account/reset-password` },
  });

  if (linkResult.error || !linkResult.data.user) {
    // Told explicitly (matching the original's accepted trade-off) rather than a generic
    // anti-enumeration message, per the original AccountController.ForgotPassword.
    return { success: false, message: "No account is linked with this email address." };
  }

  const profileResult = await admin.from("profiles").select("full_name").eq("id", linkResult.data.user.id).maybeSingle();
  const fullName = (profileResult.data as { full_name: string } | null)?.full_name ?? "";

  const actionLink = linkResult.data.properties?.action_link;
  if (actionLink) {
    await notifyPasswordReset(toEmailConfig(site, siteBaseUrl), parsed.data.email, fullName, actionLink);
  }

  return {
    success: true,
    message: "A password reset link has been sent to your email. Please check your inbox, including the spam folder.",
  };
}
