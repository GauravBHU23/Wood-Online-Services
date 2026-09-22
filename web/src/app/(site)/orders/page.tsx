import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserOrders } from "@/lib/data/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "My Orders" };

// Ported from Controllers/OrdersController.cs#Index + Views/Orders/Index.cshtml.
export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/account/login?returnUrl=/orders");

  const orders = await getUserOrders(user.id);

  const admin = createAdminClient();
  const itemCounts = new Map<number, number>();
  if (orders.length > 0) {
    const itemsResult = await admin
      .from("order_items")
      .select("order_id, quantity")
      .in(
        "order_id",
        orders.map((o) => o.id)
      );
    for (const row of itemsResult.data ?? []) {
      itemCounts.set(row.order_id, (itemCounts.get(row.order_id) ?? 0) + row.quantity);
    }
  }

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-4">
        <div className="container">
          <h1 className="mb-1">My Orders</h1>
          <p className="text-muted-wood mb-0">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="container py-4">
        {orders.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <div style={{ fontSize: "3.5rem" }}>📦</div>
              <h3>No orders yet</h3>
              <p>Once you place an order it will appear here, along with its status.</p>
              <Link href="/shop" className="btn btn-wood mt-2">
                Browse Products
              </Link>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="table-wrap">
              <table className="table table-wood mb-0">
                <thead>
                  <tr>
                    <th>Order Number</th>
                    <th>Date</th>
                    <th className="text-center">Items</th>
                    <th className="text-end">Total</th>
                    <th className="text-center">Status</th>
                    <th className="text-center">Payment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="fw-bold">{o.order_number}</td>
                      <td className="small">{formatDate(o.order_date)}</td>
                      <td className="text-center">{itemCounts.get(o.id) ?? 0}</td>
                      <td className="text-end fw-bold">₹{Math.round(o.total_amount).toLocaleString("en-IN")}</td>
                      <td className="text-center">
                        <OrderStatusBadge status={o.order_status} />
                      </td>
                      <td className="text-center small">{o.payment_method === "cod" ? "COD" : "Online"}</td>
                      <td className="text-end">
                        <Link href={`/orders/${o.id}`} className="btn btn-sm btn-outline-wood">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
