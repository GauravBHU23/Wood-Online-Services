import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

export const metadata: Metadata = { title: "Shipping & Returns" };

// New, customer-facing page extracting and presenting the delivery/cancellation/returns/warranty
// terms that already exist (in full legal language) on the Terms & Conditions page — that content
// was accurate but effectively undiscoverable buried in a wall of legal text nobody reads before
// buying furniture. This page is the scannable, visual version; Terms stays the legal source of truth.
export default async function ShippingReturnsPage() {
  const site = await getSiteSettingsPublic();

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">Shipping &amp; Returns</h1>
          <p className="text-muted-wood mb-0">Everything about delivery, cancellations, damage and warranty.</p>
        </div>
      </div>

      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="panel h-100">
              <div className="panel-body text-center">
                <div className="fs-1 mb-2">🚚</div>
                <h2 style={{ fontSize: "1.1rem" }}>Delivery</h2>
                <p className="small text-muted-wood mb-2">
                  Free on orders of ₹{Math.round(site.free_shipping_above).toLocaleString("en-IN")}+, otherwise ₹
                  {Math.round(site.shipping_charge).toLocaleString("en-IN")}.
                </p>
                <ul className="small text-muted-wood text-start mb-0 ps-3">
                  <li>Ready-stock items: 3&ndash;7 working days</li>
                  <li>Custom-made items: timeline agreed with you upfront</li>
                  <li>Someone must be present to receive and inspect delivery</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="panel h-100">
              <div className="panel-body text-center">
                <div className="fs-1 mb-2">↩️</div>
                <h2 style={{ fontSize: "1.1rem" }}>Cancellations</h2>
                <p className="small text-muted-wood mb-0">
                  Cancel anytime from your account before dispatch. Once dispatched, contact us directly. Custom-made
                  items cannot be cancelled once work has begun, since they can&apos;t be resold.
                </p>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="panel h-100">
              <div className="panel-body text-center">
                <div className="fs-1 mb-2">🛡️</div>
                <h2 style={{ fontSize: "1.1rem" }}>Damage &amp; Warranty</h2>
                <p className="small text-muted-wood mb-0">
                  Inspect at delivery and report transit damage within 48 hours with photos &mdash; we repair or
                  replace. Joinery and workmanship are warranted for 12 months from delivery.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-4">
          <div className="col-lg-8 mx-auto">
            <div className="panel">
              <div className="panel-header">Frequently Asked</div>
              <div className="panel-body">
                <h3 style={{ fontSize: "1rem" }}>How long does delivery take?</h3>
                <p className="text-muted-wood">
                  Items already in stock usually reach you in 3 to 7 working days. Custom-made pieces take longer
                  since they&apos;re built to order &mdash; we&apos;ll agree a realistic timeline with you before
                  starting work.
                </p>

                <h3 style={{ fontSize: "1rem" }} className="mt-4">
                  What if my furniture arrives damaged?
                </h3>
                <p className="text-muted-wood">
                  Please inspect the piece as soon as it arrives. If there&apos;s transit damage, photograph it and
                  let us know within 48 hours &mdash; we&apos;ll repair or replace it at no cost to you.
                </p>

                <h3 style={{ fontSize: "1rem" }} className="mt-4">
                  Can I return a custom order?
                </h3>
                <p className="text-muted-wood">
                  Custom-made items are built specifically for you and can&apos;t be resold, so they aren&apos;t
                  returnable unless there&apos;s a genuine defect in the work.
                </p>

                <h3 style={{ fontSize: "1rem" }} className="mt-4">
                  Is my purchase covered by a warranty?
                </h3>
                <p className="text-muted-wood mb-0">
                  Yes &mdash; we stand behind our joinery and workmanship for 12 months from the delivery date. This
                  doesn&apos;t cover normal wear, misuse, or damage from moisture or improper handling.
                </p>
              </div>
            </div>

            <p className="text-center text-muted-wood small mt-4 mb-0">
              Need more detail? Read the full <Link href="/terms">Terms &amp; Conditions</Link>, or{" "}
              <Link href="/contact">contact us</Link> directly.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
