"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast-provider";

// Ported from Views/Shared/_FeedbackPrompt.cshtml — shown once, right after registration, so a
// brand-new customer can leave general feedback about the shop without it being tied to any one
// product. Dismissible; never forced.
export function FeedbackPromptModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingError, setRatingError] = useState(false);
  const [commentError, setCommentError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setRatingError(false);
    setCommentError(false);

    if (rating < 1) {
      setRatingError(true);
      return;
    }
    if (comment.trim().length < 5) {
      setCommentError(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim(), fromWelcomePrompt: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message ?? "Thank you for your feedback!");
        onClose();
      } else {
        toast.error(json.message ?? "Could not submit your feedback.");
      }
    } catch {
      toast.error("We could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wos-modal-overlay is-visible" role="dialog" aria-modal="true" aria-labelledby="feedbackPromptLabel">
      <div className="wos-modal" style={{ textAlign: "left", maxWidth: 480 }}>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h2 className="wos-modal__title mb-0" id="feedbackPromptLabel" style={{ fontSize: "1.15rem" }}>
            Welcome! How does the site feel so far?
          </h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>

        <p className="text-muted-wood small mb-3">
          Your account is ready. If you have a moment, a quick rating and a line or two helps us improve — totally optional, and takes ten seconds.
        </p>

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

        <div className="mb-2">
          <label className="form-label" htmlFor="feedbackComment">
            Your feedback
          </label>
          <textarea
            id="feedbackComment"
            className="form-control"
            rows={3}
            maxLength={1000}
            placeholder="What do you think so far?"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (e.target.value.trim().length >= 5) setCommentError(false);
            }}
          />
          {commentError && <span className="field-error d-block">Please write at least 5 characters.</span>}
        </div>

        <div className="wos-modal__actions mt-3">
          <button type="button" className="btn btn-outline-wood" onClick={onClose}>
            Maybe later
          </button>
          <button type="button" className={`btn btn-wood${submitting ? " is-busy" : ""}`} disabled={submitting} onClick={handleSubmit}>
            {submitting && <span className="wos-btn-spinner" aria-hidden="true" />}
            {submitting ? "Sending..." : "Send Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
