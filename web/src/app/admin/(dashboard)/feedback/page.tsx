import type { Metadata } from "next";
import Link from "next/link";
import { getAdminFeedback } from "@/lib/data/admin-feedback";
import { StarRating } from "@/components/shop/star-rating";
import { formatDateTime } from "@/lib/utils/format";
import { FeedbackResponseForm } from "./feedback-response-form";
import { DeleteFeedbackButton } from "./delete-feedback-button";

export const metadata: Metadata = { title: "Site Feedback" };

// Ported from Areas/Admin/Controllers/FeedbackController.cs#Index + Views/Feedback/Index.cshtml.
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const search = sp.search;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getAdminFeedback({ search, page });
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(p));
    return `/admin/feedback?${params.toString()}`;
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Site Feedback</h1>
          <p className="text-muted-wood mb-0">General feedback about the shop and the site, not tied to any one product</p>
        </div>
        <div className="text-end">
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--wood-900)" }}>{result.averageRating.toFixed(1)} ★</div>
          <div className="small text-muted-wood">{result.totalCount} total</div>
        </div>
      </div>

      <div className="panel mb-3">
        <div className="panel-body py-3">
          <form method="get" className="row g-2">
            <div className="col-md-9">
              <input type="search" name="search" defaultValue={search} className="form-control" placeholder="Search by author or comment..." />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-wood flex-grow-1">
                Search
              </button>
              {search && (
                <Link href="/admin/feedback" className="btn btn-outline-secondary">
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
            <h3>No feedback yet</h3>
            <p>Feedback customers leave after registering, or from their account, will appear here.</p>
          </div>
        </div>
      ) : (
        <>
          {result.items.map((feedback) => (
            <div key={feedback.id} className="panel mb-3">
              <div className="panel-body">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <strong style={{ color: "var(--wood-900)" }}>{feedback.author_name}</strong>
                      {feedback.from_welcome_prompt && <span className="badge badge-soft">New customer welcome</span>}
                    </div>
                    <div className="small text-muted-wood mt-1">{formatDateTime(feedback.created_at)}</div>
                  </div>

                  <StarRating value={feedback.rating} showCount={false} showValue={false} size="1rem" />
                </div>

                <p className="mb-3" style={{ whiteSpace: "pre-line", fontSize: ".94rem", lineHeight: 1.65 }}>
                  {feedback.comment}
                </p>

                <FeedbackResponseForm feedbackId={feedback.id} adminResponse={feedback.admin_response} />
                <DeleteFeedbackButton feedbackId={feedback.id} />
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
