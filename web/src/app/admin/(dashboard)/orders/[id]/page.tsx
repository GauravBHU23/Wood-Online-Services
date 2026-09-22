import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminOrderById } from "@/lib/data/admin-orders";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { UpdateOrderStatusForm } from "./update-order-status-form";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const order = await getAdminOrderById(Number(id));
  return { title: order ? `Order ${order.order_number}` : "Order" };
}

// Ported from Areas/Admin/Controllers/OrdersController.cs#Details + Views/Orders/Details.cshtml.
export default async function AdminOrderDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const order = await getAdminOrderById(orderId);
  if (!order) notFound();

  const digits = order.shipping_phone.replace(/\D/g, "");

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Order {order.order_number}</h1>
          <p className="text-muted-wood mb-0">{formatDateTime(order.order_date)}</p>
        </div>
        <div className="d-flex gap-2">
          <a href={`/invoice/${order.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-wood">
            🧾 Invoice
          </a>
          <Link href="/admin/orders" className="btn btn-outline-wood">
            ← All Orders
          </Link>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="panel mb-3">
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
                        <Link href={`/admin/products/${item.product_id}/edit`} style={{ color: "var(--wood-900)", fontWeight: 600 }}>
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

          <div className="row g-3">
            <div className="col-md-6">
              <div className="panel h-100">
                <div className="panel-header">Delivery address</div>
                <div className="panel-body">
                  <p className="mb-1">
                    <strong>{order.shipping_name}</strong>
                  </p>
                  <p className="mb-2">
                    📞 <a href={`tel:${order.shipping_phone}`}>{order.shipping_phone}</a>{" "}
                    <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="badge btn-whatsapp text-decoration-none ms-1">
                      WhatsApp
                    </a>
                  </p>
                  <p className="mb-0 small">
                    {order.shipping_address}
                    <br />
                    {order.shipping_city}, {order.shipping_state} - {order.shipping_pin_code}
                  </p>
                  {order.notes && (
                    <>
                      <hr />
                      <p className="small mb-0">
                        <strong>Customer note:</strong>
                        <br />
                        {order.notes}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="panel h-100">
                <div className="panel-header">Customer Account</div>
                <div className="panel-body">
                  {order.user ? (
                    <>
                      <p className="mb-1">
                        <strong>{order.user.full_name}</strong>
                      </p>
                      <p className="mb-1 small">
                        <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
                      </p>
                      {order.user.created_at && <p className="mb-0 small text-muted-wood">Member since {formatDate(order.user.created_at)}</p>}
                    </>
                  ) : (
                    <p className="text-muted-wood mb-0 small">No account details found.</p>
                  )}

                  <hr />

                  <p className="small mb-1">
                    <strong>Payment:</strong> {order.payment_method === "cod" ? "Cash on Delivery" : "Online"}
                  </p>
                  {order.payment_reference && <p className="small mb-0 text-muted-wood">Ref: {order.payment_reference}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <UpdateOrderStatusForm
            orderId={order.id}
            orderStatus={order.order_status}
            paymentStatus={order.payment_status}
            trackingNumber={order.tracking_number}
          />

          <div className="panel">
            <div className="panel-header">Timeline</div>
            <div className="panel-body">
              <ul className="list-unstyled mb-0 small">
                <li className="mb-2">
                  📥 <strong>Order placed</strong>
                  <br />
                  <span className="text-muted-wood ms-4">{formatDateTime(order.order_date)}</span>
                </li>
                {order.shipped_date && (
                  <li className="mb-2">
                    🚚 <strong>Shipped</strong>
                    <br />
                    <span className="text-muted-wood ms-4">{formatDateTime(order.shipped_date)}</span>
                  </li>
                )}
                {order.delivered_date && (
                  <li className="mb-0">
                    ✅ <strong>Delivered</strong>
                    <br />
                    <span className="text-muted-wood ms-4">{formatDateTime(order.delivered_date)}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
