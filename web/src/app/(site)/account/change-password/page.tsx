import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change Password" };

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/account/login?returnUrl=/account/change-password");

  return <ChangePasswordForm />;
}
