import Link from "next/link";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { getActiveCategories } from "@/lib/data/products";
import { VisitorBadge } from "@/components/layout/visitor-badge";

// Ported from Views/Shared/_Layout.cshtml's <footer class="footer-wood">.
export async function Footer() {
  const [site, categories] = await Promise.all([getSiteSettingsPublic(), getActiveCategories()]);
  const year = new Date().getFullYear();

  return (
    <footer className="footer-wood">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-4 col-md-6">
            <h5>{site.shop_name}</h5>
            <p className="mb-2" style={{ fontSize: ".92rem" }}>
              {site.tagline}
            </p>
            <p style={{ fontSize: ".9rem" }}>
              Solid wood furniture for dining, bedroom, storage and custom work. Every piece is
              handmade from seasoned, termite-treated timber.
            </p>
          </div>

          <div className="col-lg-2 col-md-6">
            <h5>Quick Links</h5>
            <ul className="list-unstyled">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/shop">Products</Link>
              </li>
              <li>
                <Link href="/about">About Us</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <Link href="/orders">Track Order</Link>
              </li>
            </ul>
          </div>

          <div className="col-lg-3 col-md-6">
            <h5>Categories</h5>
            <ul className="list-unstyled">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/shop?categoryId=${c.id}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-lg-3 col-md-6">
            <h5>Get in Touch</h5>
            <ul className="list-unstyled">
              <li>
                {site.address_line1}
                <br />
                {site.address_line2}
              </li>
              <li>
                <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
              </li>
              <li>
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </li>
              <li>{site.working_hours}</li>
            </ul>
            <a className="btn btn-whatsapp btn-sm mt-2" href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer">
              Chat on WhatsApp
            </a>
          </div>
        </div>

        {site.feature_visitor_counter && (
          <div className="text-center mt-4">
            <VisitorBadge />
          </div>
        )}

        <div className="footer-bottom">
          <div className="row g-2 align-items-center">
            <div className="col-md-6 text-center text-md-start">
              &copy; {year} {site.shop_name}. All rights reserved.
            </div>
            <div className="col-md-6 text-center text-md-end">
              Designed &amp; Developed by <strong>Er Gaurav Kumar</strong>
              &nbsp;&middot;&nbsp;
              <Link href="/license">MIT License</Link>
              &nbsp;&middot;&nbsp;
              <Link href="/privacy">Privacy</Link>
              &nbsp;&middot;&nbsp;
              <Link href="/terms">Terms</Link>
              &nbsp;&middot;&nbsp;
              <Link href="/admin/login" style={{ opacity: 0.6 }}>
                Admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
