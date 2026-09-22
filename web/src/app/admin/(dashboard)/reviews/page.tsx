import type { Metadata } from "next";
import Link from "next/link";
import { getAdminReviews } from "@/lib/data/admin-reviews";
import { StarRating } from "@/components/shop/star-rating";
import { formatDateTime } from "@/lib/utils/format";
import { ReviewModerationForm } from "./review-moderation-form";
import { DeleteReviewButton } from "./delete-review-button";

export const metadata: Metadata = { title: "Reviews" };

// Ported from Areas/Admin/Controllers/ReviewsController.cs#Index + Views/Reviews/Index.cshtml.
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const search = sp.search;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getAdminReviews({ status, search, page });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function tabHref(s: string) {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (search) params.set("search", search);
    return `/admin/reviews?${params.toString()}`;
  }
  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(p));
    return `/admin/reviews?${params.toString()}`;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Reviews</h1>
          <p className="text-muted-wood mb-0">Moderate customer ratings and comments</p>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-body py-3">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <Link href={tabHref("")} className={`btn btn-sm ${!status ? "btn-wood" : "btn-outline-wood"}`}>
              All ({result.totalCount})
            </Link>
            <Link href={tabHref("pending")} className={`btn btn-sm ${status === "pending" ? "btn-wood" : "btn-outline-wood"}`}>
              Pending ({result.pendingCount})
            </Link>
            <Link href={tabHref("approved")} className={`btn btn-sm ${status === "approved" ? "btn-wood" : "btn-outline-wood"}`}>
              Approved ({result.approvedCount})
            </Link>
            <Link href={tabHref("rejected")} className={`btn btn-sm ${status === "rejected" ? "btn-wood" : "btn-outline-wood"}`}>
              Rejected ({result.rejectedCount})
            </Link>
          </div>

          <form method="get" className="row g-2">
            <input type="hidden" name="status" value={status} />
            <div className="col-md-9">
              <input type="search" name="search" defaultValue={search} className="form-control" placeholder="Search by author, product or comment..." />
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

      {result.items.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            <div style={{ fontSize: "3rem", opacity: 0.35 }}>★</div>
            <h3>No reviews found</h3>
            <p>Customer reviews will appear here once they are submitted.</p>
          </div>
        </div>
      ) : (
        <>
          {result.items.map((review) => (
            <div key={review.id} className="panel mb-3">
              <div className="panel-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <strong style={{ color: "var(--wood-900)" }}>{review.author_name}</strong>
                      {review.is_verified_purchase && <span className="badge-verified">Verified Purchase</span>}
                      {review.status === "pending" && <span className="badge bg-warning text-dark">Pending</span>}
                      {review.status === "approved" && <span className="badge bg-success">Approved</span>}
                      {review.status === "rejected" && <span className="badge bg-danger">Rejected</span>}
                    </div>
                    <div className="small text-muted-wood mt-1">
                      on{" "}
                      <Link href={`/admin/products/${review.product_id}/edit`}>{review.product?.name ?? "Deleted product"}</Link>
                      {" · "}
                      {formatDateTime(review.created_at)}
                    </div>
                  </div>

                  <StarRating value={review.rating} showCount={false} showValue={false} size="1rem" />
                </div>

                {review.title && <div className="fw-bold mb-1">{review.title}</div>}

                <p className="mb-3" style={{ whiteSpace: "pre-line", fontSize: ".94rem", lineHeight: 1.65 }}>
                  {review.comment}
                </p>

                <ReviewModerationForm reviewId={review.id} status={review.status} adminResponse={review.admin_response} helpfulCount={review.helpful_count} />

                <DeleteReviewButton reviewId={review.id} />
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <nav>
              <ul className="pagination justify-content-center">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((i) => (
                  <li key={i} className={`page-item ${i === page ? "active" : ""}`}>
                    <Link className="page-link" href={pageHref(i)}>
                      {i}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      )}
    </>
  );
}
