import Link from "next/link";
import type { Metadata } from "next";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

export const metadata: Metadata = {
  title: "About Us",
  description: "About our workshop - our craft, the quality of wood we use, and the promise we make.",
};

const STEPS = [
  { icon: "1️⃣", title: "Choosing the Timber", text: "Sheesham, Teak, Mango or Pine, chosen for the job. Timber comes straight from the market, with no middleman." },
  { icon: "2️⃣", title: "Seasoning and Treatment", text: "The wood is dried until the moisture is gone, then termite treated so pests are no longer a worry." },
  { icon: "3️⃣", title: "Craftsmanship", text: "Our craftsmen cut mortise-and-tenon joints by hand. We do not rely on nails and glue." },
  { icon: "4️⃣", title: "Finishing and Delivery", text: "The polish of your choice, then delivery and assembly at your home. We stay with you until the job is done." },
];

// Ported from Controllers/HomeController.cs#About + Views/Home/About.cshtml.
export default async function AboutPage() {
  const site = await getSiteSettingsPublic();

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">About Us</h1>
          <p className="text-muted-wood mb-0">{site.tagline}</p>
        </div>
      </div>

      <div className="container py-5">
        <div className="row g-4 g-lg-5 align-items-center mb-5">
          <div className="col-lg-6">
            <h2 className="section-title">A Trade Passed Down</h2>
            <p>
              {site.shop_name} is a family run workshop. Woodwork is our trade, and we learned it from our elders.
              What we build for you is what we keep in our own homes.
            </p>
            <p>
              Cheap furniture is everywhere today: particle board, plywood, glued-on veneer. It lasts two years, then
              swells or breaks. That is not what we make. Every piece we make is <strong>solid wood</strong> throughout,
              the same timber inside and out.
            </p>
            <p className="mb-0">That is why our pieces cost a little more. But buy once, and it will serve the next generation.</p>
          </div>
          <div className="col-lg-6">
            <img src="/img/workshop.svg" alt="Our workshop" className="img-fluid rounded" style={{ border: "1px solid var(--line)" }} />
          </div>
        </div>

        <h2 className="section-title text-center mb-4">How We Work</h2>
        <div className="row g-4 mb-5">
          {STEPS.map((s) => (
            <div key={s.title} className="col-md-6 col-lg-3">
              <div className="panel h-100">
                <div className="panel-body text-center">
                  <div style={{ fontSize: "2rem" }} className="mb-2">
                    {s.icon}
                  </div>
                  <h3 style={{ fontSize: "1.05rem" }}>{s.title}</h3>
                  <p className="small text-muted-wood mb-0">{s.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-4 mb-5">
          <div className="col-lg-6">
            <div className="panel h-100">
              <div className="panel-header">Our Promise</div>
              <div className="panel-body">
                <ul className="list-unstyled mb-0">
                  <li className="mb-2">
                    ✅ <strong>Solid wood only</strong> - no particle board or plywood filling
                  </li>
                  <li className="mb-2">
                    ✅ <strong>Seasoned and treated</strong> timber that will not crack or attract termites
                  </li>
                  <li className="mb-2">
                    ✅ <strong>Made to your size</strong> without any fuss
                  </li>
                  <li className="mb-2">
                    ✅ <strong>Honest pricing</strong> - the quoted price is the final price, no hidden charges
                  </li>
                  <li className="mb-0">
                    ✅ <strong>Support after the sale</strong> - tell us if anything is wrong and we will fix it
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="panel h-100">
              <div className="panel-header">Shop Details</div>
              <div className="panel-body">
                <table className="table table-sm spec-table mb-0">
                  <tbody>
                    <tr>
                      <th>Shop</th>
                      <td>{site.shop_name}</td>
                    </tr>
                    <tr>
                      <th>Address</th>
                      <td>
                        {site.address_line1}
                        <br />
                        {site.address_line2}
                      </td>
                    </tr>
                    <tr>
                      <th>Phone</th>
                      <td>
                        <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
                      </td>
                    </tr>
                    <tr>
                      <th>WhatsApp</th>
                      <td>
                        <a href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer">
                          Chat on WhatsApp
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <th>Email</th>
                      <td>
                        <a href={`mailto:${site.email}`}>{site.email}</a>
                      </td>
                    </tr>
                    <tr>
                      <th>Hours</th>
                      <td>{site.working_hours}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body text-center py-5">
            <h2 className="mb-3">Visit Our Shop</h2>
            <p className="text-muted-wood mx-auto mb-4" style={{ maxWidth: "36rem" }}>
              A photograph cannot show the real quality of wood. Visit the shop once, feel it with your own hands,
              and then decide.
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              <Link href="/contact" className="btn btn-wood btn-lg">
                Contact Us
              </Link>
              <Link href="/shop" className="btn btn-outline-wood btn-lg">
                Browse Products
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
