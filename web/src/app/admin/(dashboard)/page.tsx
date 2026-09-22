import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardData } from "@/lib/data/admin-dashboard";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { formatDateTime, formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

// Ported from Areas/Admin/Controllers/DashboardController.cs + Views/Dashboard/Index.cshtml.
export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Dashboard</h1>
          <p className="text-muted-wood mb-0">Your shop at a glance</p>
        </div>
        <div className="d-flex gap-2">
          <Link href="/admin/products/new" className="btn btn-wood btn-sm">
            + New Product
          </Link>
          <Link href="/admin/categories/new" className="btn btn-outline-wood btn-sm">
            + Category
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="stat-tile">
            <div className="d-flex justify-content-between align-items-start">
              <div className="stat-label">Total Revenue</div>
              <span className="stat-tile__icon" style={{ background: "var(--wood-100)", color: "var(--wood-700)" }}>
                💰
              </span>
            </div>
            <div className="stat-value">₹{Math.round(data.totalRevenue).toLocaleString("en-IN")}</div>
            <div className="small text-muted-wood">30 days: ₹{Math.round(data.revenueLast30Days).toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="stat-tile" style={{ borderLeftColor: "var(--gold)" }}>
            <div className="d-flex justify-content-between align-items-start">
              <div className="stat-label">Orders</div>
              <span className="stat-tile__icon" style={{ background: "#fdf1d8", color: "#a67418" }}>
                📦
              </span>
            </div>
            <div className="stat-value">{data.totalOrders}</div>
            <div className={`small ${data.pendingOrders > 0 ? "text-danger fw-bold" : "text-muted-wood"}`}>{data.pendingOrders} pending</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="stat-tile" style={{ borderLeftColor: "var(--success)" }}>
            <div className="d-flex justify-content-between align-items-start">
              <div className="stat-label">Products</div>
              <span className="stat-tile__icon" style={{ background: "#e3f5ea", color: "#1e8449" }}>
                🪑
              </span>
            </div>
            <div className="stat-value">{data.totalProducts}</div>
            <div className={`small ${data.outOfStockCount > 0 ? "text-danger fw-bold" : "text-muted-wood"}`}>{data.outOfStockCount} out of stock</div>
          </div>
        </div>

        <div className="col-6 col-lg-3">
          <div className="stat-tile" style={{ borderLeftColor: "var(--danger)" }}>
            <div className="d-flex justify-content-between align-items-start">
              <div className="stat-label">Inquiries</div>
              <span className="stat-tile__icon" style={{ background: "#fbe4e2", color: "#b3261e" }}>
                💬
              </span>
            </div>
            <div className="stat-value">{data.totalInquiries}</div>
            <div className={`small ${data.newInquiries > 0 ? "text-danger fw-bold" : "text-muted-wood"}`}>{data.newInquiries} new</div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="panel">
            <div className="panel-header d-flex justify-content-between align-items-center">
              <span>Recent Orders</span>
              <Link href="/admin/orders" className="btn btn-sm btn-outline-wood">
                View all
              </Link>
            </div>

            {data.recentOrders.length === 0 ? (
              <div className="panel-body text-center text-muted-wood py-4">
                <div style={{ fontSize: "2rem" }}>📦</div>
                <p className="mb-0 small">No orders yet.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table-wood mb-0">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th className="text-end">Total</th>
                      <th className="text-center">Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <div className="fw-bold small">{o.order_number}</div>
                          <div className="small text-muted-wood">{formatDateTime(o.order_date)}</div>
                        </td>
                        <td className="small">
                          {o.shipping_name}
                          <br />
                          <span className="text-muted-wood">{o.shipping_phone}</span>
                        </td>
                        <td className="text-end fw-bold">₹{Math.round(o.total_amount).toLocaleString("en-IN")}</td>
                        <td className="text-center">
                          <OrderStatusBadge status={o.order_status} />
                        </td>
                        <td className="text-end">
                          <Link href={`/admin/orders/${o.id}`} className="btn btn-sm btn-outline-wood">
                            →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="panel">
            <div className="panel-header d-flex justify-content-between align-items-center">
              <span>Recent Inquiries</span>
              <Link href="/admin/inquiries" className="btn btn-sm btn-outline-wood">
                View all
              </Link>
            </div>

            {data.recentInquiries.length === 0 ? (
              <div className="panel-body text-center text-muted-wood py-4">
                <div style={{ fontSize: "2rem" }}>💬</div>
                <p className="mb-0 small">No inquiries yet.</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {data.recentInquiries.map((i) => (
                  <Link key={i.id} href={`/admin/inquiries/${i.id}`} className="list-group-item list-group-item-action">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="fw-bold small">{i.name}</div>
                        <div className="small text-muted-wood">{i.phone}</div>
                        {i.product && (
                          <div className="small">
                            <span className="badge badge-soft">{i.product.name}</span>
                          </div>
                        )}
                        <div className="small text-truncate text-muted-wood mt-1">{i.message}</div>
                      </div>
                      <div className="text-end flex-shrink-0">
                        {i.status === "new" ? (
                          <span className="badge bg-danger">New</span>
                        ) : i.status === "contacted" ? (
                          <span className="badge bg-info text-dark">Contacted</span>
                        ) : (
                          <span className="badge bg-secondary">Closed</span>
                        )}
                        <div className="small text-muted-wood mt-1">{formatDate(i.created_at)}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-12">
          <div className="panel">
            <div className="panel-header">⚠️ Low Stock (3 or fewer)</div>

            {data.lowStockProducts.length === 0 ? (
              <div className="panel-body text-center text-muted-wood py-4">
                <div style={{ fontSize: "2rem" }}>✅</div>
                <p className="mb-0 small">All products have healthy stock levels.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table-wood mb-0">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th className="text-center">Stock</th>
                      <th className="text-end">Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowStockProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <img
                              src={p.image_url || "/img/cat-custom.svg"}
                              alt=""
                              style={{ width: 44, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }}
                            />
                            <span className="fw-bold small">{p.name}</span>
                          </div>
                        </td>
                        <td className="small">{p.category?.name}</td>
                        <td className="text-center">
                          <span className={`badge ${p.stock_quantity <= 0 ? "bg-danger" : "bg-warning text-dark"}`}>{p.stock_quantity}</span>
                        </td>
                        <td className="text-end">₹{Math.round(p.price).toLocaleString("en-IN")}</td>
                        <td className="text-end">
                          <Link href={`/admin/products/${p.id}/edit`} className="btn btn-sm btn-outline-wood">
                            Update Stock
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
