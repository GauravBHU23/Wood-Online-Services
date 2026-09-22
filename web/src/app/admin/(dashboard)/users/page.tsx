import type { Metadata } from "next";
import Link from "next/link";
import { getAdminUsers } from "@/lib/data/admin-users";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Customers" };

// Ported from Areas/Admin/Controllers/UsersController.cs#Index + Views/Users/Index.cshtml.
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search;
  const filter = sp.filter ?? "";
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getAdminUsers({ search, filter, page });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function href(overrides: { filter?: string; page?: number }) {
    const params = new URLSearchParams();
    const f = overrides.filter !== undefined ? overrides.filter : filter;
    if (search) params.set("search", search);
    if (f) params.set("filter", f);
    if (overrides.page) params.set("page", String(overrides.page));
    return `/admin/users?${params.toString()}`;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Customers</h1>
          <p className="text-muted-wood mb-0">
            {result.totalCount} registered account{result.totalCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-body py-3">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Link href={href({ filter: "" })} className={`btn btn-sm ${!filter ? "btn-wood" : "btn-outline-wood"}`}>
              All
            </Link>
            <Link href={href({ filter: "blocked" })} className={`btn btn-sm ${filter === "blocked" ? "btn-wood" : "btn-outline-wood"}`}>
              Blocked ({result.blockedCount})
            </Link>
          </div>

          <form method="get" className="row g-2">
            <input type="hidden" name="filter" value={filter} />
            <div className="col-md-9">
              <input type="search" name="search" defaultValue={search} className="form-control" placeholder="Search by name, email or phone..." />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-wood flex-grow-1">
                Search
              </button>
              {search && (
                <Link href={href({})} className="btn btn-outline-secondary">
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
            <div style={{ fontSize: "3rem" }}>👤</div>
            <h3>No customers found</h3>
            <p>Registered customers will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table-wood mb-0">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th className="text-center">Orders</th>
                    <th className="text-end">Total Spend</th>
                    <th className="text-center">Status</th>
                    <th className="text-end"></th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((u) => (
                    <tr key={u.userId} className={u.isBlocked ? "table-danger" : ""}>
                      <td>
                        <div className="fw-bold small">{u.fullName || "—"}</div>
                        <div className="small text-muted-wood">Joined {formatDate(u.createdDate)}</div>
                      </td>
                      <td className="small">
                        <a href={`mailto:${u.email}`} className="d-block text-truncate" style={{ maxWidth: 200 }}>
                          {u.email}
                        </a>
                        {u.phoneNumber && (
                          <a href={`tel:${u.phoneNumber}`} className="text-muted-wood">
                            {u.phoneNumber}
                          </a>
                        )}
                      </td>
                      <td className="small text-muted-wood">{u.city ? `${u.city}, ${u.state}` : "—"}</td>
                      <td className="text-center">{u.orderCount}</td>
                      <td className="text-end fw-bold">₹{Math.round(u.totalSpend).toLocaleString("en-IN")}</td>
                      <td className="text-center">
                        {u.isAdmin ? (
                          <span className="badge bg-secondary">Admin</span>
                        ) : u.isBlocked ? (
                          <span className="badge bg-danger">Blocked</span>
                        ) : (
                          <span className="badge bg-success">Active</span>
                        )}
                      </td>
                      <td className="text-end">
                        <Link href={`/admin/users/${u.userId}`} className="btn btn-sm btn-outline-wood">
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
                        <Link className="page-link" href={href({ page: i })}>
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
