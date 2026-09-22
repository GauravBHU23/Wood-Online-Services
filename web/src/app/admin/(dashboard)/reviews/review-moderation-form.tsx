"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReviewStatusAction } from "@/lib/admin/review-actions";
import { useToast } from "@/components/ui/toast-provider";
import type { ReviewStatus } from "@/types/database";

// Ported from the moderation form in Views/Reviews/Index.cshtml.
export function ReviewModerationForm({
  reviewId,
  status,
  adminResponse,
  helpfulCount,
}: {
  reviewId: number;
  status: ReviewStatus;
  adminResponse: string | null;
  helpfulCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [response, setResponse] = useState(adminResponse ?? "");
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<ReviewStatus | null>(null);

  function submit(newStatus: ReviewStatus) {
    setPendingAction(newStatus);
    startTransition(async () => {
      const result = await updateReviewStatusAction(reviewId, newStatus, response);
      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(status === "approved" ? "approved" : "approved");
      }}
    >
      <div className="mb-2">
        <label className="form-label small" htmlFor={`response-${reviewId}`}>
          Public response (optional)
        </label>
        <textarea
          id={`response-${reviewId}`}
          rows={2}
          className="form-control form-control-sm"
          maxLength={500}
          placeholder="Reply publicly under this review"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
      </div>

      <div className="d-flex flex-wrap gap-2">
        {status !== "approved" && (
          <button type="button" className="btn btn-sm btn-wood" disabled={pending} onClick={() => submit("approved")}>
            {pending && pendingAction === "approved" ? "Approving..." : "Approve"}
          </button>
        )}

        {status !== "rejected" && (
          <button type="button" className="btn btn-sm btn-outline-danger" disabled={pending} onClick={() => submit("rejected")}>
            {pending && pendingAction === "rejected" ? "Rejecting..." : "Reject"}
          </button>
        )}

        {status === "approved" && (
          <button type="button" className="btn btn-sm btn-outline-wood" disabled={pending} onClick={() => submit("approved")}>
            {pending ? "Saving..." : "Save Response"}
          </button>
        )}

        <span className="ms-auto small text-muted-wood align-self-center">{helpfulCount} found helpful</span>
      </div>
    </form>
  );
}
