import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/account/login?returnUrl=/account/profile");

  const admin = createAdminClient();
  const result = await admin
    .from("profiles")
    .select("full_name, address, city, state, pin_code")
    .eq("id", user.id)
    .maybeSingle();
  const profile = result.data as {
    full_name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pin_code: string | null;
  } | null;

  return (
    <ProfileForm
      initial={{
        fullName: profile?.full_name ?? "",
        email: user.email ?? "",
        phoneNumber: (user.user_metadata?.phone as string | undefined) ?? "",
        address: profile?.address ?? "",
        city: profile?.city ?? "",
        state: profile?.state ?? "",
        pinCode: profile?.pin_code ?? "",
      }}
    />
  );
}
