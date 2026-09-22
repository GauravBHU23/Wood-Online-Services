import type { Metadata } from "next";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Privacy Policy" };

// Ported from Controllers/HomeController.cs#Privacy + Views/Home/Privacy.cshtml.
export default async function PrivacyPage() {
  const site = await getSiteSettingsPublic();

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">Privacy Policy</h1>
          <p className="text-muted-wood mb-0">Last updated {formatDate(new Date())}</p>
        </div>
      </div>

      <div className="container py-5">
        <div className="row">
          <div className="col-lg-8 mx-auto">
            <div className="panel">
              <div className="panel-body">
                <p>
                  This policy explains what information {site.shop_name} collects when you use this website, why we
                  collect it, and what we do with it.
                </p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Information We Collect
                </h2>
                <ul>
                  <li>
                    <strong>Account details</strong> — your name, email address and phone number when you create an
                    account.
                  </li>
                  <li>
                    <strong>Delivery address</strong> — the address you enter at checkout, saved to your profile only
                    if you ask us to.
                  </li>
                  <li>
                    <strong>Order history</strong> — what you ordered, when, and its delivery status.
                  </li>
                  <li>
                    <strong>Inquiries</strong> — the name, phone number and message you send through our contact form.
                  </li>
                  <li>
                    <strong>Reviews</strong> — the rating and comment you post, shown publicly alongside your name.
                  </li>
                  <li>
                    <strong>Technical data</strong> — your IP address, approximate location (city and country),
                    browser type and the pages you visit.
                  </li>
                </ul>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Payment Information
                </h2>
                <p>
                  We <strong>never see or store your card, UPI or banking details</strong>. Online payments are
                  handled entirely by our payment partner on their own secure systems. We only receive confirmation
                  of whether a payment succeeded, along with a transaction reference.
                </p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Your IP Address
                </h2>
                <p>
                  We record IP addresses to count visitors and to investigate abuse or fraud. The footer of this
                  site shows <strong>your own</strong> IP address and approximate location back to you. No visitor
                  can ever see another visitor&apos;s IP address through this website.
                </p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Cookies
                </h2>
                <p>We use a small number of cookies, all of them necessary for the site to work:</p>
                <ul>
                  <li>
                    <strong>Sign-in cookie</strong> — keeps you signed in between visits.
                  </li>
                  <li>
                    <strong>Cart cookie</strong> — remembers your cart before you sign in.
                  </li>
                  <li>
                    <strong>Security cookie</strong> — protects forms against cross-site request forgery.
                  </li>
                  <li>
                    <strong>Visitor cookie</strong> — counts each visit once per day.
                  </li>
                </ul>
                <p>We do not use advertising or third-party tracking cookies.</p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  How We Use Your Information
                </h2>
                <ul>
                  <li>To process, deliver and support your orders</li>
                  <li>To reply to your inquiries</li>
                  <li>To send order confirmations and status updates by email</li>
                  <li>To display reviews on product pages</li>
                  <li>To keep the website secure and prevent abuse</li>
                </ul>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Sharing
                </h2>
                <p>
                  We do not sell your information. We share it only with the payment gateway (to process payments),
                  with delivery partners (to deliver your order), and where the law requires it.
                </p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Security
                </h2>
                <p>
                  Passwords are stored hashed, never in plain text. All traffic is encrypted over HTTPS. Access to
                  customer data is restricted to authorised staff.
                </p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Your Rights
                </h2>
                <p>
                  You may view and update your details from your profile page at any time. To request a copy of your
                  data, or its deletion, contact us using the details below. Note that we must keep order and
                  invoice records for the period required by law.
                </p>

                <h2 style={{ fontSize: "1.15rem" }} className="mt-4">
                  Contact
                </h2>
                <p className="mb-0">
                  {site.shop_name}
                  <br />
                  {site.address_line1}
                  <br />
                  {site.address_line2}
                  <br />
                  Phone: <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
                  <br />
                  Email: <a href={`mailto:${site.email}`}>{site.email}</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
