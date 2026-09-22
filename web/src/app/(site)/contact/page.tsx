import type { Metadata } from "next";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { getProductById } from "@/lib/data/products";
import { InquiryForm } from "@/components/shop/inquiry-form";

export const metadata: Metadata = { title: "Contact Us" };

// Ported from Controllers/HomeController.cs#Contact (GET) + Views/Home/Contact.cshtml.
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const { productId } = await searchParams;
  const site = await getSiteSettingsPublic();

  let productName: string | null = null;
  let defaultMessage = "";
  const parsedProductId = productId ? Number(productId) : undefined;
  if (parsedProductId) {
    const product = await getProductById(parsedProductId);
    if (product) {
      productName = product.name;
      defaultMessage = `I would like more information about "${product.name}". `;
    }
  }

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">Get in Touch</h1>
          <p className="text-muted-wood mb-0">Any question about a product, a price or custom work, just ask.</p>
        </div>
      </div>

      <div className="container py-5">
        <div className="row g-4">
          <div className="col-lg-7">
            <div className="panel">
              <div className="panel-header">
                Send Inquiry
                {productName && <span className="badge badge-soft ms-2">{productName}</span>}
              </div>
              <div className="panel-body">
                <InquiryForm productId={parsedProductId} defaultMessage={defaultMessage} />
                <div className="mt-3">
                  <a href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg">
                    Send via WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="panel mb-3">
              <div className="panel-header">Shop Address</div>
              <div className="panel-body">
                <p className="mb-3">
                  📍 <strong>{site.shop_name}</strong>
                  <br />
                  <span className="ms-4">{site.address_line1}</span>
                  <br />
                  <span className="ms-4">{site.address_line2}</span>
                </p>
                <p className="mb-2">
                  📞 <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
                </p>
                <p className="mb-2">
                  💬{" "}
                  <a href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer">
                    Chat on WhatsApp
                  </a>
                </p>
                <p className="mb-2">
                  ✉️ <a href={`mailto:${site.email}`}>{site.email}</a>
                </p>
                <p className="mb-0">🕐 {site.working_hours}</p>
              </div>
            </div>

            {site.map_embed_url ? (
              <div className="panel">
                <div className="panel-header d-flex justify-content-between align-items-center">
                  <span>Find Us</span>
                  <a
                    className="btn btn-sm btn-outline-wood"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.shop_name}, ${site.address_line1}, ${site.address_line2}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Maps
                  </a>
                </div>
                <div className="ratio ratio-4x3">
                  <iframe
                    src={site.map_embed_url}
                    style={{ border: 0, width: "100%", height: "100%" }}
                    allowFullScreen
                    title="Shop location map"
                    referrerPolicy="origin-when-cross-origin"
                  />
                </div>
              </div>
            ) : (
              <div className="panel">
                <div className="panel-header">Find Us</div>
                <div className="panel-body text-center text-muted-wood py-4">
                  <div style={{ fontSize: "2.5rem" }} className="mb-2">
                    🗺️
                  </div>
                  <p className="small mb-0">The map is not configured yet. An admin can add the Google Maps embed link in site settings.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
