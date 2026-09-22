import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserById } from "@/lib/data/admin-users";
import { OrderStatusBadge } from "@/components/shop/order-status-badge";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { BlockUserButton, UnblockUserButton } from "./block-user-buttons";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const user = await getAdminUserById(id);
  return { title: user?.fullName || "Customer" };
}

// Ported from Areas/Admin/Controllers/UsersController.cs#Details + Views/Users/Details.cshtml.
export default async function AdminUserDetailPage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const user = await getAdminUserById(id);
  if (!user) notFound();

  const totalSpend = user.orders.filter((o) => o.order_status !== "cancelled").reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">{user.fullName || "Customer"}</h1>
          <p className="text-muted-wood mb-0">Customer since {formatDate(user.createdDate)}</p>
        </div>
        <Link href="/admin/users" className="btn btn-outline-wood">
          ← All Customers
        </Link>
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="panel mb-3">
            <div className="panel-header">Account</div>
            <div className="panel-body">
              <dl className="row mb-0 small">
                <dt className="col-5">Email</dt>
                <dd className="col-7">
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </dd>

                <dt className="col-5">Phone</dt>
                <dd className="col-7">
                  {user.phoneNumber ? <a href={`tel:${user.phoneNumber}`}>{user.phoneNumber}</a> : <span className="text-muted-wood">—</span>}
                </dd>

                <dt className="col-5">Address</dt>
                <dd className="col-7">
                  {user.address ? (
                    <>
                      {user.address}
                      <br />
                      {user.city}, {user.state} {user.pinCode}
                    </>
                  ) : (
                    <span className="text-muted-wood">Not provided</span>
                  )}
                </dd>

                <dt className="col-5">Status</dt>
                <dd className="col-7">
                  {user.isAdmin ? (
                    <span className="badge bg-secondary">Admin account</span>
                  ) : user.isBlocked ? (
                    <span className="badge bg-danger">Blocked</span>
                  ) : (
                    <span className="badge bg-success">Active</span>
                  )}
                </dd>
              </dl>
            </div>
          </div>

          {!user.isAdmin && (
            <div className="panel">
              <div className="panel-body">
                {user.isBlocked ? <UnblockUserButton userId={user.userId} /> : <BlockUserButton userId={user.userId} />}
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-8">
          <div className="panel">
            <div className="panel-header d-flex justify-content-between align-items-center">
              <span>Orders ({user.orders.length})</span>
              <span className="fw-bold">Total spend: ₹{Math.round(totalSpend).toLocaleString("en-IN")}</span>
            </div>

            {user.orders.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: "3rem" }}>📦</div>
                <h3>No orders yet</h3>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table-wood mb-0">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th className="text-end">Total</th>
                      <th className="text-center">Payment</th>
                      <th className="text-center">Status</th>
                      <th className="text-end"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <div className="fw-bold small">{o.order_number}</div>
                          <div className="small text-muted-wood">{formatDateTime(o.order_date)}</div>
                        </td>
                        <td className="text-end fw-bold">₹{Math.round(o.total_amount).toLocaleString("en-IN")}</td>
                        <td className="text-center small">
                          <span className={`badge ${o.payment_status === "paid" ? "bg-success" : "bg-secondary"}`}>{o.payment_status}</span>
                        </td>
                        <td className="text-center">
                          <OrderStatusBadge status={o.order_status} />
                        </td>
                        <td className="text-end">
                          <Link href={`/admin/orders/${o.id}`} className="btn btn-sm btn-outline-wood">
                            View
                          </Link>{" "}
                          <a href={`/invoice/${o.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-wood">
                            🧾
                          </a>
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
