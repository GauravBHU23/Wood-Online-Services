import Link from "next/link";
import type { Metadata } from "next";
import { getCategoriesWithCounts, getFeaturedProducts, getLatestProducts } from "@/lib/data/products";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { ProductCard } from "@/components/shop/product-card";

export const metadata: Metadata = { title: "Home" };

// Ported from Controllers/HomeController.cs#Index + Views/Home/Index.cshtml.
export default async function HomePage() {
  const [site, categories, featured, latest] = await Promise.all([
    getSiteSettingsPublic(),
    getCategoriesWithCounts(),
    getFeaturedProducts(8),
    getLatestProducts(4),
  ]);

  return (
    <>
      <section className="hero">
        <div className="container py-5">
          <div className="row">
            <div className="col-lg-7">
              <span className="badge badge-soft mb-3" style={{ fontSize: ".8rem" }}>
                Solid Wood · Handcrafted
              </span>
              <h1 className="mb-3">Strong wooden furniture for your home</h1>
              <p className="lead mb-4">
                Handmade furniture in seasoned Sheesham, Teak and Mango wood. From dining to bedroom, storage and
                custom work, all in one place.
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link href="/shop" className="btn btn-wood btn-lg">
                  Browse Products
                </Link>
                <a href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg">
                  Ask on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-4 bg-wood-50 border-bottom border-wood">
        <div className="container">
          <div className="row text-center g-3">
            <div className="col-6 col-md-3">
              <div className="fs-3">🔨</div>
              <div className="fw-bold text-wood">Handmade</div>
              <div className="small text-muted-wood">Skill, not machines</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="fs-3">🛡️</div>
              <div className="fw-bold text-wood">Termite-treated</div>
              <div className="small text-muted-wood">Seasoned timber</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="fs-3">📏</div>
              <div className="fw-bold text-wood">Custom sizes</div>
              <div className="small text-muted-wood">Built to your needs</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="fs-3">🚚</div>
              <div className="fw-bold text-wood">Home Delivery</div>
              <div className="small text-muted-wood">₹{Math.round(site.free_shipping_above).toLocaleString("en-IN")}+ and above</div>
            </div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="py-5">
          <div className="container">
            <h2 className="section-title text-center">Categories</h2>
            <div className="row g-3 g-md-4">
              {categories.map((cat) => (
                <div key={cat.id} className="col-6 col-md-4 col-lg-2">
                  <Link href={`/shop?categoryId=${cat.id}`} className="cat-tile">
                    <img src={cat.image_url || "/img/cat-custom.svg"} alt={cat.name} loading="lazy" />
                    <h3>{cat.name}</h3>
                    <p>{cat.productCount} items</p>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="py-5 bg-wood-50">
          <div className="container">
            <div className="d-flex justify-content-between align-items-end flex-wrap gap-2 mb-4">
              <h2 className="section-title mb-0">Featured Products</h2>
              <Link href="/shop" className="btn btn-outline-wood btn-sm">
                View all →
              </Link>
            </div>
            <div className="row g-3 g-md-4">
              {featured.map((p) => (
                <div key={p.id} className="col-6 col-md-4 col-lg-3">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-5">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <img src="/img/workshop.svg" alt="Our workshop" className="img-fluid rounded" style={{ border: "1px solid var(--line)" }} loading="lazy" />
            </div>
            <div className="col-lg-6">
              <h2 className="section-title">Our Craft</h2>
              <p>
                We have worked with wood for generations. Every table, chair and wardrobe is made by hand in our
                workshop, with no shortcuts and no cheap plywood filling.
              </p>
              <p>
                The timber is properly seasoned first so it will not crack or warp later. Then it is termite
                treated, and our craftsmen cut mortise-and-tenon joints that stay strong for decades.
              </p>
              <ul className="list-unstyled">
                <li className="mb-2">✅ Solid wood, the same timber inside and out</li>
                <li className="mb-2">✅ Can be custom made to your measurements</li>
                <li className="mb-2">✅ Polish of your choice: natural, walnut or mahogany</li>
                <li className="mb-2">✅ Home delivery and assembly</li>
              </ul>
              <Link href="/about" className="btn btn-outline-wood">
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {latest.length > 0 && (
        <section className="py-5 bg-wood-50">
          <div className="container">
            <h2 className="section-title">New Arrivals</h2>
            <div className="row g-3 g-md-4">
              {latest.map((p) => (
                <div key={p.id} className="col-6 col-md-4 col-lg-3">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-5">
        <div className="container">
          <div className="panel">
            <div className="panel-body text-center py-5">
              <h2 className="mb-3">Need Something Different?</h2>
              <p className="text-muted-wood mb-4 mx-auto" style={{ maxWidth: "38rem" }}>
                Have furniture made to your own measurements, design and choice of wood. Send a photo or a sketch and
                we will send you a quotation.
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <Link href="/contact" className="btn btn-wood btn-lg">
                  Send Inquiry
                </Link>
                <a href={`tel:${site.phone.replace(/\s/g, "")}`} className="btn btn-outline-wood btn-lg">
                  📞 {site.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
