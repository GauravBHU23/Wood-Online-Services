import type { Metadata } from "next";
import Link from "next/link";
import { getAdminOrders } from "@/lib/data/admin-orders";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Orders" };

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

// Ported from Areas/Admin/Controllers/OrdersController.cs#Index + Views/Orders/Index.cshtml.
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const search = sp.search;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getAdminOrders({ status, search, page });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function tabHref(s: string) {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (search) params.set("search", search);
    return `/admin/orders?${params.toString()}`;
  }

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(p));
    return `/admin/orders?${params.toString()}`;
  }

  const tabCounts: Record<string, number | undefined> = {
    pending: result.pendingCount,
    confirmed: result.confirmedCount,
    shipped: result.shippedCount,
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Orders</h1>
          <p className="text-muted-wood mb-0">
            {result.totalCount} order{result.totalCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-body py-3">
          <div className="d-flex flex-wrap gap-2 mb-3">
            {STATUS_TABS.map((tab) => (
              <Link key={tab.key} href={tabHref(tab.key)} className={`btn btn-sm ${status === tab.key ? "btn-wood" : "btn-outline-wood"}`}>
                {tab.label}
                {tabCounts[tab.key] !== undefined && ` (${tabCounts[tab.key]})`}
              </Link>
            ))}
          </div>

          <form method="get" className="row g-2">
            <input type="hidden" name="status" value={status} />
            <div className="col-md-9">
              <input type="search" name="search" defaultValue={search} className="form-control" placeholder="Search by order number, name or phone..." />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-wood flex-grow-1">
                Search
              </button>
              {search && (
                <Link href={tabHref(status)} className="btn btn-outline-secondary">
                  Reset
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="panel">
        {result.items.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: "3rem" }}>📦</div>
            <h3>No orders found</h3>
            <p>Whenever a customer places an order it will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table-wood mb-0">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Address</th>
                    <th className="text-center">Items</th>
                    <th className="text-end">Total</th>
                    <th className="text-center">Payment</th>
                    <th className="text-center">Status</th>
                    <th className="text-end"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((o) => (
                    <tr key={o.id} className={o.order_status === "pending" ? "table-warning" : ""}>
                      <td>
                        <div className="fw-bold small">{o.order_number}</div>
                        <div className="small text-muted-wood">{formatDateTime(o.order_date)}</div>
                      </td>
                      <td className="small">
                        {o.shipping_name}
                        <br />
                        <a href={`tel:${o.shipping_phone}`} className="text-muted-wood">
                          {o.shipping_phone}
                        </a>
                      </td>
                      <td className="small text-muted-wood" style={{ maxWidth: 200 }}>
                        <div className="text-truncate">
                          {o.shipping_city}, {o.shipping_state}
                        </div>
                        <div>{o.shipping_pin_code}</div>
                      </td>
                      <td className="text-center">{o.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                      <td className="text-end fw-bold">₹{Math.round(o.total_amount).toLocaleString("en-IN")}</td>
                      <td className="text-center small">
                        <div>{o.payment_method === "cod" ? "COD" : "Online"}</div>
                        <span className={`badge ${o.payment_status === "paid" ? "bg-success" : "bg-secondary"}`}>{o.payment_status}</span>
                      </td>
                      <td className="text-center">
                        <OrderStatusBadge status={o.order_status} />
                      </td>
                      <td className="text-end">
                        <Link href={`/admin/orders/${o.id}`} className="btn btn-sm btn-outline-wood">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="panel-body">
                <nav>
                  <ul className="pagination justify-content-center mb-0">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((i) => (
                      <li key={i} className={`page-item ${i === page ? "active" : ""}`}>
                        <Link className="page-link" href={pageHref(i)}>
                          {i}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
