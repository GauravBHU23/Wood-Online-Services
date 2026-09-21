"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StarRating } from "@/components/shop/star-rating";
import { useToast } from "@/components/ui/toast-provider";
import type { ReviewSummary, Review } from "@/lib/data/reviews";
import { formatDate } from "@/lib/utils/format";

// Ported from Views/Shared/_ReviewSection.cshtml — same classes/markup and behaviour
// (star picker, char counter, helpful vote, review pagination).

export function ReviewSection({
  productId,
  productDetailPath,
  summary,
  reviews,
  reviewPage,
  reviewTotalPages,
  isSignedIn,
  userReview,
  userHasPurchased,
  votedReviewIds,
}: {
  productId: number;
  productDetailPath: string;
  summary: ReviewSummary;
  reviews: Review[];
  reviewPage: number;
  reviewTotalPages: number;
  isSignedIn: boolean;
  userReview: Review | null;
  userHasPurchased: boolean;
  votedReviewIds: number[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [rating, setRating] = useState(userReview?.rating ?? 0);
  const [title, setTitle] = useState(userReview?.title ?? "");
  const [comment, setComment] = useState(userReview?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState(false);
  const [commentError, setCommentError] = useState(false);
  const [votes, setVotes] = useState<Record<number, { voted: boolean; count: number }>>(
    Object.fromEntries(reviews.map((r) => [r.id, { voted: votedReviewIds.includes(r.id), count: r.helpful_count }]))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRatingError(false);
    setCommentError(false);

    if (rating < 1) {
      setRatingError(true);
      return;
    }
    if (comment.trim().length < 10) {
      setCommentError(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, title: title.trim() || undefined, comment: comment.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message ?? "Thank you for your review.");
        router.refresh();
      } else {
        toast.error(json.message ?? "Could not submit your review.");
      }
    } catch {
      toast.error("We could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHelpful(reviewId: number) {
    if (!isSignedIn) return;
    const current = votes[reviewId] ?? { voted: false, count: 0 };
    // Optimistic toggle, matching the original's instant UI feedback.
    setVotes((v) => ({ ...v, [reviewId]: { voted: !current.voted, count: current.count + (current.voted ? -1 : 1) } }));

    try {
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        // Revert on failure.
        setVotes((v) => ({ ...v, [reviewId]: current }));
        toast.error(json.message ?? "Could not record your vote.");
      }
    } catch {
      setVotes((v) => ({ ...v, [reviewId]: current }));
      toast.error("We could not reach the server. Please try again.");
    }
  }

  return (
    <div className="panel" id="reviews">
      <div className="panel-header d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span>Customer Reviews</span>
        {summary.totalReviews > 0 && <StarRating value={summary.averageRating} count={summary.totalReviews} size=".95rem" />}
      </div>

      <div className="panel-body">
        {summary.totalReviews > 0 && (
          <div className="row g-4 mb-4 pb-4 border-bottom border-wood">
            <div className="col-md-4 text-center">
              <div style={{ fontSize: "3rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--wood-900)", lineHeight: 1 }}>
                {summary.averageRating.toFixed(1)}
              </div>
              <div className="my-2">
                <StarRating value={summary.averageRating} showCount={false} showValue={false} size="1.25rem" />
              </div>
              <div className="small text-muted-wood">
                Based on {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
              </div>
            </div>

            <div className="col-md-8">
              {summary.breakdown.map((row) => (
                <div key={row.stars} className="d-flex align-items-center gap-2 mb-2">
                  <span className="small text-muted-wood" style={{ width: 52 }}>
                    {row.stars} star{row.stars === 1 ? "" : "s"}
                  </span>
                  <div className="rating-bar">
                    <div className="rating-bar__fill" style={{ width: `${row.percentage}%` }}></div>
                  </div>
                  <span className="small text-muted-wood" style={{ width: 34, textAlign: "right" }}>
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isSignedIn ? (
          <div className="mb-4 pb-4 border-bottom border-wood">
            <h3 style={{ fontSize: "1.05rem" }} className="mb-3">
              {userReview ? "Edit Your Review" : "Write a Review"}
            </h3>

            {userReview?.status === "pending" && (
              <div className="alert alert-warning py-2 small">
                Your review is awaiting approval and is not visible to other customers yet.
              </div>
            )}
            {userReview?.status === "rejected" && (
              <div className="alert alert-danger py-2 small">Your review was not approved. You may edit it and submit again.</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label d-block">
                  Your Rating <span className="text-danger">*</span>
                </label>
                <div className="star-picker" role="radiogroup" aria-label="Select a rating">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={rating >= i ? "is-active" : ""}
                      role="radio"
                      aria-checked={rating === i}
                      aria-label={`${i} star${i === 1 ? "" : "s"}`}
                      onClick={() => {
                        setRating(i);
                        setRatingError(false);
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {ratingError && <span className="field-error d-block">Please select a rating.</span>}
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="reviewTitle">
                  Title (optional)
                </label>
                <input
                  type="text"
                  id="reviewTitle"
                  className="form-control"
                  maxLength={150}
                  placeholder="Sum up your experience in a few words"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="reviewComment">
                  Your Review <span className="text-danger">*</span>
                </label>
                <textarea
                  id="reviewComment"
                  className="form-control"
                  rows={4}
                  maxLength={2000}
                  placeholder="How is the quality, the finish, the delivery? What would you tell another customer?"
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (e.target.value.trim().length >= 10) setCommentError(false);
                  }}
                />
                <div className="char-counter">{comment.length} / 2000</div>
                {commentError && <span className="field-error d-block">Your review must be at least 10 characters.</span>}
              </div>

              <button type="submit" className={`btn btn-wood${submitting ? " is-busy" : ""}`} disabled={submitting}>
                {submitting && <span className="wos-btn-spinner" aria-hidden="true" />}
                {submitting ? "Submitting..." : userReview ? "Update Review" : "Submit Review"}
              </button>

              {userHasPurchased && <span className="badge-verified ms-2">Verified Purchase</span>}
            </form>
          </div>
        ) : (
          <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 py-2">
            <span className="small mb-0">Sign in to share your experience with this product.</span>
            <Link href={`/account/login?returnUrl=${encodeURIComponent(`${productDetailPath}#reviews`)}`} className="btn btn-wood btn-sm">
              Sign In
            </Link>
          </div>
        )}

        <div>
          {reviews.length === 0 ? (
            <div className="empty-state py-4">
              <div style={{ fontSize: "2.5rem", opacity: 0.35 }}>★</div>
              <p className="mb-0 small">No reviews yet. Be the first to review this product.</p>
            </div>
          ) : (
            <>
              {reviews.map((review) => {
                const initial = review.author_name.trim() ? review.author_name.trim()[0].toUpperCase() : "C";
                const vote = votes[review.id] ?? { voted: false, count: review.helpful_count };

                return (
                  <div key={review.id} className="review-item">
                    <div className="d-flex gap-3">
                      <div className="review-avatar" aria-hidden="true">
                        {initial}
                      </div>

                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                          <strong style={{ fontSize: ".94rem", color: "var(--wood-900)" }}>{review.author_name}</strong>
                          {review.is_verified_purchase && <span className="badge-verified">Verified Purchase</span>}
                          <span className="small text-muted-wood ms-auto">{formatDate(review.created_at)}</span>
                        </div>

                        <div className="mb-2">
                          <StarRating value={review.rating} showCount={false} showValue={false} size=".85rem" />
                        </div>

                        {review.title && (
                          <div className="fw-bold mb-1" style={{ fontSize: ".95rem" }}>
                            {review.title}
                          </div>
                        )}

                        <p className="mb-2" style={{ fontSize: ".92rem", lineHeight: 1.65, whiteSpace: "pre-line" }}>
                          {review.comment}
                        </p>

                        {review.admin_response && (
                          <div className="bg-wood-50 border-start border-3 rounded p-2 mb-2" style={{ borderColor: "var(--wood-500)" }}>
                            <div className="small fw-bold text-wood mb-1">Response from the shop</div>
                            <div className="small mb-0">{review.admin_response}</div>
                          </div>
                        )}

                        {isSignedIn ? (
                          <button type="button" className={`helpful-btn${vote.voted ? " is-voted" : ""}`} onClick={() => handleHelpful(review.id)}>
                            Helpful <span>({vote.count})</span>
                          </button>
                        ) : (
                          vote.count > 0 && <span className="small text-muted-wood">{vote.count} found this helpful</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {reviewTotalPages > 1 && (
                <nav className="mt-3" aria-label="Review pages">
                  <ul className="pagination pagination-sm justify-content-center mb-0">
                    {Array.from({ length: reviewTotalPages }, (_, i) => i + 1).map((i) => (
                      <li key={i} className={`page-item ${i === reviewPage ? "active" : ""}`}>
                        <Link className="page-link" href={`${productDetailPath}?reviewPage=${i}#reviews`}>
                          {i}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
