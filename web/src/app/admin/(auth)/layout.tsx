import { getSiteSettingsPublic } from "@/lib/data/site-settings";

// Ported from Areas/Admin/Views/Shared/_AdminAuthLayout.cshtml — a standalone dark page with
// just the logo and the form, no header/footer/chat widget from the main site.
export default async function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteSettingsPublic();

  return (
    <div style={{ background: "var(--wood-900, #3f2817)", minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div className="container py-5">
        <div className="row">
          <div className="col-md-6 col-lg-5 mx-auto">
            <div className="text-center mb-4">
              <div style={{ color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.6rem" }}>
                {site.shop_name}
              </div>
              <div
                className="mt-2"
                style={{ color: "var(--wood-200,#e5d3c0)", fontSize: ".85rem", letterSpacing: ".08em", textTransform: "uppercase" }}
              >
                Admin Panel
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
