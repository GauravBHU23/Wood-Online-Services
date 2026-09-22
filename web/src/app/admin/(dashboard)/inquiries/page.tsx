import type { Metadata } from "next";
import Link from "next/link";
import { getAdminInquiries } from "@/lib/data/admin-inquiries";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Inquiries" };

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "closed", label: "Closed" },
];

// Ported from Areas/Admin/Controllers/InquiriesController.cs#Index + Views/Inquiries/Index.cshtml.
export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const search = sp.search;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getAdminInquiries({ status, search, page });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function tabHref(s: string) {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (search) params.set("search", search);
    return `/admin/inquiries?${params.toString()}`;
  }
  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(p));
    return `/admin/inquiries?${params.toString()}`;
  }

  const tabCounts: Record<string, number> = { new: result.newCount, contacted: result.contactedCount, closed: result.closedCount };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Inquiries</h1>
          <p className="text-muted-wood mb-0">Customer questions and custom order requests</p>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-body py-3">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Link href={tabHref("")} className={`btn btn-sm ${!status ? "btn-wood" : "btn-outline-wood"}`}>
              All ({result.totalCount})
            </Link>
            {STATUS_TABS.slice(1).map((tab) => (
              <Link key={tab.key} href={tabHref(tab.key)} className={`btn btn-sm ${status === tab.key ? "btn-wood" : "btn-outline-wood"}`}>
                {tab.label} ({tabCounts[tab.key]})
              </Link>
            ))}
          </div>

          <form method="get" className="row g-2">
            <input type="hidden" name="status" value={status} />
            <div className="col-md-9">
              <input type="search" name="search" defaultValue={search} className="form-control" placeholder="Search by name, phone or message..." />
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
            <div style={{ fontSize: "3rem" }}>💬</div>
            <h3>No inquiries found</h3>
            <p>Whenever a customer submits the contact form it will appear here.</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table table-wood mb-0">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Message</th>
                    <th>Date</th>
                    <th className="text-center">Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((i) => (
                    <tr key={i.id} className={i.status === "new" ? "table-warning" : ""}>
                      <td>
                        <div className="fw-bold small">{i.name}</div>
                        <div className="small">
                          <a href={`tel:${i.phone}`}>{i.phone}</a>
                        </div>
                        {i.email && (
                          <div className="small text-muted-wood text-truncate" style={{ maxWidth: 170 }}>
                            {i.email}
                          </div>
                        )}
                      </td>
                      <td className="small">{i.product ? <span className="badge badge-soft">{i.product.name}</span> : <span className="text-muted-wood">General</span>}</td>
                      <td className="small" style={{ maxWidth: 280 }}>
                        <div className="text-truncate">{i.message}</div>
                      </td>
                      <td className="small text-nowrap">{formatDate(i.created_at)}</td>
                      <td className="text-center">
                        {i.status === "new" ? (
                          <span className="badge bg-danger">New</span>
                        ) : i.status === "contacted" ? (
                          <span className="badge bg-info text-dark">Contacted</span>
                        ) : (
                          <span className="badge bg-secondary">Closed</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          <a href={`https://wa.me/${i.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-whatsapp" title="WhatsApp">
                            💬
                          </a>
                          <Link href={`/admin/inquiries/${i.id}`} className="btn btn-sm btn-outline-wood">
                            View
                          </Link>
                        </div>
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
