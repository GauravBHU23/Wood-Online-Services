"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInquiryAction } from "@/lib/admin/inquiry-actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";

export function DeleteInquiryButton({ inquiryId }: { inquiryId: number }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();

  async function handleClick() {
    const ok = await confirm({ title: "Delete inquiry", message: "This inquiry will be permanently deleted. Continue?", tone: "danger" });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteInquiryAction(inquiryId);
      if (result.success) {
        toast.success(result.message ?? "Deleted.");
        router.push("/admin/inquiries");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not delete.");
      }
    });
  }

  return (
    <button type="button" className={`btn btn-outline-danger w-100${pending ? " is-busy" : ""}`} disabled={pending} onClick={handleClick}>
      {pending ? "Deleting..." : "Delete Inquiry"}
    </button>
  );
}
