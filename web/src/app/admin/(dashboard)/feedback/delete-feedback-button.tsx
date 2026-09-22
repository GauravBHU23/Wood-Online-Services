"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFeedbackAction } from "@/lib/admin/feedback-actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";

export function DeleteFeedbackButton({ feedbackId }: { feedbackId: number }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();

  async function handleClick() {
    const ok = await confirm({ title: "Delete feedback", message: "This feedback will be permanently deleted. Continue?", tone: "danger" });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteFeedbackAction(feedbackId);
      if (result.success) {
        toast.success(result.message ?? "Deleted.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not delete.");
      }
    });
  }

  return (
    <button type="button" className="btn btn-sm btn-link text-danger p-0 mt-2" style={{ fontSize: ".82rem" }} disabled={pending} onClick={handleClick}>
      Delete permanently
    </button>
  );
}
