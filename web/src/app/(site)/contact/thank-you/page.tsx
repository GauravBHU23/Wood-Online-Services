import Link from "next/link";
import type { Metadata } from "next";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

export const metadata: Metadata = { title: "Thank You" };

// Ported from Controllers/HomeController.cs#ThankYou + Views/Home/ThankYou.cshtml.
export default async function ThankYouPage() {
  const site = await getSiteSettingsPublic();

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-lg-7 mx-auto">
          <div className="panel">
            <div className="panel-body text-center py-5">
              <div style={{ fontSize: "3.5rem" }} className="mb-3">
                ✅
              </div>
              <h1 className="mb-3">Thank You!</h1>
              <p className="text-muted-wood mb-4">
                We have received your message. We will contact you by phone or WhatsApp within 24 hours.
              </p>
              <p className="mb-4">
                If you need to speak sooner, call us directly —{" "}
                <a href={`tel:${site.phone.replace(/\s/g, "")}`}>
                  <strong>{site.phone}</strong>
                </a>
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <Link href="/shop" className="btn btn-wood">
                  Continue Shopping
                </Link>
                <Link href="/" className="btn btn-outline-wood">
                  Go to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
