import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { AdminChrome } from "./admin-chrome";
import { IdleLogout } from "@/components/layout/idle-logout";
import { adminLogoutAction } from "@/lib/auth/admin-actions";

// Ported from Areas/Admin/Views/Shared/_AdminLayout.cshtml — the full admin shell (topbar +
// sidebar with live badge counts), applied to every /admin/** route except the auth pages
// (admin/(auth)/*, which use their own minimal layout).
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const site = await getSiteSettingsPublic();

  const db = createAdminClient();
  const [newInquiries, pendingOrders, pendingReviews, feedbackCount] = await Promise.all([
    db.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new").then((r) => r.count ?? 0),
    db.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "pending").then((r) => r.count ?? 0),
    db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0),
    db.from("site_feedback").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
  ]);

  return (
    <>
      <AdminChrome
        shopName={site.shop_name}
        adminName={admin.fullName}
        newInquiries={newInquiries}
        pendingOrders={pendingOrders}
        pendingReviews={pendingReviews}
        feedbackCount={feedbackCount}
      >
        {children}
      </AdminChrome>

      {/* requireAdmin() above already redirects an unauthenticated visitor before this ever
          renders, so isSignedIn is always true here — the admin panel holds more sensitive data
          than the customer side, so the same 20-minute idle timeout applies here too. */}
      <IdleLogout isSignedIn logoutAction={adminLogoutAction} loginPath="/admin/login" />
    </>
  );
}
