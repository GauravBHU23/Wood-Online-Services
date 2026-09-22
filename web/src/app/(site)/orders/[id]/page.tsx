import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrderById } from "@/lib/data/orders";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { formatDateTime } from "@/lib/utils/format";
import { RetryPaymentButton } from "./retry-payment-button";
import { CancelOrderButton } from "./cancel-order-button";
import { PaymentStatusPoller } from "./payment-status-poller";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) return { title: "Order" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Order" };

  const order = await getOrderById(orderId, user.id);
  return { title: order ? `Order ${order.order_number}` : "Order" };
}

// Ported from Controllers/OrdersController.cs#Details + Views/Orders/Details.cshtml.
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<{ awaiting?: string }>;
}) {
  const { id } = await params;
  const { awaiting } = await searchParams;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/account/login?returnUrl=${encodeURIComponent(`/orders/${id}`)}`);

  const [order, site] = await Promise.all([getOrderById(orderId, user.id), getSiteSettingsPublic()]);
  if (!order) notFound();

  const isCancelled = order.order_status === "cancelled";
  const stageByStatus: Record<string, number> = { pending: 0, confirmed: 1, shipped: 2, delivered: 3 };
  const stage = stageByStatus[order.order_status] ?? -1;
  const canCancel = order.order_status === "pending" || order.order_status === "confirmed";
  const stages = ["Order Received", "Confirmed", "Shipped", "Delivered"];

  const paymentStatusBadge: Record<string, { cls: string; label: string }> = {
    paid: { cls: "bg-success", label: "Paid" },
    failed: { cls: "bg-danger", label: "Not completed" },
    refunded: { cls: "bg-secondary", label: "Refunded" },
    pending: { cls: "bg-warning text-dark", label: "Pending" },
  };
  const paymentBadge = paymentStatusBadge[order.payment_status] ?? paymentStatusBadge.pending;

  const waText = encodeURIComponent(`I have a question about order ${order.order_number}.`);

  return (
    <>
      {awaiting === "true" && order.payment_method === "online" && order.payment_status === "pending" && (
        <PaymentStatusPoller orderId={order.id} />
      )}

      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h1 className="mb-1">Order {order.order_number}</h1>
            <p className="text-muted-wood mb-0">{formatDateTime(order.order_date)}</p>
          </div>
          <OrderStatusBadge status={order.order_status} />
        </div>
      </div>

      <div className="container py-4">
        <div className="panel mb-4">
          <div className="panel-body">
            {isCancelled ? (
              <div className="text-center py-3">
                <div style={{ fontSize: "2.5rem" }}>❌</div>
                <h3 className="mb-1">This order has been cancelled</h3>
                <p className="text-muted-wood mb-0 small">
                  For any questions, call <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>.
                </p>
              </div>
            ) : (
              <>
                <div className="tracker">
                  {stages.map((label, i) => {
                    const cls = i < stage ? "done" : i === stage ? "current" : "";
                    return (
                      <div key={label} className={`tracker-step ${cls}`}>
                        <div className="tracker-dot">{i < stage ? "✓" : i + 1}</div>
                        <div className="tracker-label">{label}</div>
                      </div>
                    );
                  })}
                </div>

                {order.tracking_number ? (
                  <div className="alert alert-info py-2 mb-0 text-center">
                    📦 Tracking number: <strong>{order.tracking_number}</strong>
                  </div>
                ) : order.order_status === "pending" ? (
                  <p className="text-center small text-muted-wood mb-0">We will call you shortly to confirm your order.</p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="panel">
              <div className="panel-header">Items</div>
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
                        <td>
                          <Link href={`/shop/${item.product_id}`} style={{ color: "var(--wood-900)", fontWeight: 600 }}>
                            {item.product_name}
                          </Link>
                        </td>
                        <td className="text-end">₹{Math.round(item.unit_price).toLocaleString("en-IN")}</td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-end fw-bold">₹{Math.round(item.unit_price * item.quantity).toLocaleString("en-IN")}</td>
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
          </div>

          <div className="col-lg-4">
            <div className="panel mb-3">
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
                {order.notes && (
                  <>
                    <hr />
                    <p className="small mb-0">
                      <strong>Note:</strong> {order.notes}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="panel mb-3">
              <div className="panel-header">Payment</div>
              <div className="panel-body">
                <p className="mb-1">
                  <strong>{order.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</strong>
                </p>

                <p className="mb-2 small text-muted-wood">
                  Status: <span className={`badge ${paymentBadge.cls}`}>{paymentBadge.label}</span>
                  {order.payment_method === "cod" && order.payment_status === "pending" && !isCancelled && (
                    <>
                      <br />
                      At the time of delivery, ₹{Math.round(order.total_amount).toLocaleString("en-IN")} is payable.
                    </>
                  )}
                </p>

                {order.payment_reference && (
                  <div className="bg-wood-50 border border-wood rounded px-2 py-1">
                    <div className="small text-muted-wood" style={{ fontSize: ".75rem" }}>
                      Transaction reference
                    </div>
                    <code style={{ fontSize: ".82rem", color: "var(--wood-900)" }}>{order.payment_reference}</code>
                  </div>
                )}

                {order.payment_method === "online" && order.payment_status !== "paid" && !isCancelled && (
                  <>
                    <div className="mt-3 no-print">
                      <RetryPaymentButton orderId={order.id} />
                    </div>
                    <p className="small text-muted-wood mt-2 mb-0">No amount has been charged. Your order is held until payment completes.</p>
                  </>
                )}
              </div>
            </div>

            <div className="d-grid gap-2 no-print">
              <a href={`/invoice/${order.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-wood">
                Download Invoice
              </a>

              {canCancel && <CancelOrderButton orderId={order.id} />}

              <a href={`https://wa.me/${site.whatsapp_number}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
                Ask on WhatsApp
              </a>

              <Link href="/orders" className="btn btn-outline-wood">
                ← All Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
