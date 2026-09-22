import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Ported from Areas/Admin/Controllers/AdminBaseController.cs's [Authorize(Roles = Roles.Admin)].
// proxy.ts already gates "is anyone signed in" for /admin/**; this is the actual role check,
// re-verified server-side on every admin page load (never trust a client-side role claim alone).
export async function requireAdmin(): Promise<{ id: string; email: string; fullName: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const admin = createAdminClient();
  const result = await admin.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  const profile = result.data as { role: "customer" | "admin"; full_name: string } | null;

  if (profile?.role !== "admin") redirect("/admin/login");

  return { id: user.id, email: user.email ?? "", fullName: profile.full_name || "Admin" };
}
