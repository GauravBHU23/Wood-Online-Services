"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToFeedbackAction } from "@/lib/admin/feedback-actions";
import { useToast } from "@/components/ui/toast-provider";

export function FeedbackResponseForm({ feedbackId, adminResponse }: { feedbackId: number; adminResponse: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [response, setResponse] = useState(adminResponse ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await respondToFeedbackAction(feedbackId, response);
      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-2">
        <label className="form-label small" htmlFor={`fb-response-${feedbackId}`}>
          Internal note / response (optional)
        </label>
        <textarea
          id={`fb-response-${feedbackId}`}
          rows={2}
          className="form-control form-control-sm"
          maxLength={500}
          placeholder="Not shown publicly"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-sm btn-outline-wood" disabled={pending}>
        {pending ? "Saving..." : "Save Note"}
      </button>
    </form>
  );
}
