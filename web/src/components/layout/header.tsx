import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCartCount } from "@/lib/data/cart";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { HeaderNav } from "@/components/layout/header-nav";

// Ported from Views/Shared/_Layout.cshtml — same markup/classes (.topbar, .navbar-wood, etc.)
// so the header renders identically to the original.
export async function Header() {
  const site = await getSiteSettingsPublic();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let isAdmin = false;
  if (user) {
    const admin = createAdminClient();
    const result = await admin.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
    const profile = result.data as { full_name: string; role: "customer" | "admin" } | null;
    fullName = profile?.full_name ?? null;
    isAdmin = profile?.role === "admin";
  }

  const cartCount = await getCartCount();

  return (
    <>
      <div className="topbar d-none d-md-block">
        <div className="container d-flex justify-content-between align-items-center">
          <span>
            <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            &nbsp;&middot;&nbsp;
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </span>
          <span>{site.working_hours}</span>
        </div>
      </div>

      <header>
        <nav className="navbar navbar-expand-lg navbar-wood sticky-top">
          <div className="container">
            <Link className="navbar-brand" href="/" aria-label={`${site.shop_name} home`}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem", color: "var(--wood-900)" }}>
                {site.shop_name}
              </span>
            </Link>

            <HeaderNav cartCount={cartCount} isSignedIn={!!user} isAdmin={isAdmin} fullName={fullName} />
          </div>
        </nav>
      </header>
    </>
  );
}
