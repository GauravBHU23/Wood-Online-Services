import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrderByNumber } from "@/lib/data/orders";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

export const metadata: Metadata = { title: "Order Confirmed" };

// Ported from Controllers/CheckoutController.cs#Success + Views/Checkout/Success.cshtml.
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string }>;
}) {
  const { orderNumber } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/account/login?returnUrl=${encodeURIComponent(`/checkout/success?orderNumber=${orderNumber ?? ""}`)}`);
  if (!orderNumber) notFound();

  const [order, site] = await Promise.all([getOrderByNumber(orderNumber, user.id), getSiteSettingsPublic()]);
  if (!order) notFound();

  return (
    <div className="container py-5">
      <div className="row">
        <div className="col-lg-8 mx-auto">
          <div className="panel mb-4">
            <div className="panel-body text-center py-5">
              <div style={{ fontSize: "3.5rem" }} className="mb-3">
                🎉
              </div>
              <h1 className="mb-2">Order Received!</h1>
              <p className="text-muted-wood mb-3">Thank you, {order.shipping_name}. We have received your order.</p>
              <div className="d-inline-block bg-wood-50 border border-wood rounded px-4 py-2 mb-3">
                <div className="small text-muted-wood">Order Number</div>
                <div className="fw-bold" style={{ fontSize: "1.2rem", color: "var(--wood-900)" }}>
                  {order.order_number}
                </div>
              </div>
              <p className="small text-muted-wood mb-0">
                We will call you shortly on <strong>{order.shipping_phone}</strong> to confirm your order.
              </p>
            </div>
          </div>

          <div className="panel mb-4">
            <div className="panel-header">Order Details</div>
            <div className="table-wrap">
              <table className="table table-wood mb-0">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-end">Price</th>
                    <th className="text-center">Qty</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td className="text-end">₹{Math.round(item.unit_price).toLocaleString("en-IN")}</td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-end">₹{Math.round(item.unit_price * item.quantity).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-wood-50">
                  <tr>
                    <td colSpan={3} className="text-end">
                      Subtotal
                    </td>
                    <td className="text-end">₹{Math.round(order.sub_total).toLocaleString("en-IN")}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="text-end">
                      Delivery
                    </td>
                    <td className="text-end">{order.shipping_charge <= 0 ? "Free" : `₹${Math.round(order.shipping_charge).toLocaleString("en-IN")}`}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="text-end fw-bold">
                      Total
                    </td>
                    <td className="text-end fw-bold" style={{ fontSize: "1.1rem", color: "var(--wood-800)" }}>
                      ₹{Math.round(order.total_amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="panel h-100">
                <div className="panel-header">Delivery address</div>
                <div className="panel-body">
                  <p className="mb-1">
                    <strong>{order.shipping_name}</strong>
                  </p>
                  <p className="mb-1">📞 {order.shipping_phone}</p>
                  <p className="mb-0 small">
                    {order.shipping_address}
                    <br />
                    {order.shipping_city}, {order.shipping_state} - {order.shipping_pin_code}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="panel h-100">
                <div className="panel-header">Payment</div>
                <div className="panel-body">
                  <p className="mb-1">
                    <strong>{order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</strong>
                  </p>
                  <p className="mb-0 small text-muted-wood">
                    {order.payment_method === "cod"
                      ? `₹${Math.round(order.total_amount).toLocaleString("en-IN")} is payable when the order is delivered.`
                      : "Payment has been received."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-wrap justify-content-center gap-2 no-print">
            <Link href={`/orders/${order.id}`} className="btn btn-wood">
              Track Order
            </Link>
            <Link href="/shop" className="btn btn-outline-wood">
              Continue Shopping
            </Link>
          </div>

          <p className="text-center small text-muted-wood mt-4">
            If you need help, call <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a> or{" "}
            <a href={`https://wa.me/${site.whatsapp_number}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
