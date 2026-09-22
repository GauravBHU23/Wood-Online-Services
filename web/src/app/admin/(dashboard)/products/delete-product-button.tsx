"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProductAction } from "@/lib/admin/product-actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";

export function DeleteProductButton({ productId, productName }: { productId: number; productName: string }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();

  async function handleClick() {
    const ok = await confirm({
      title: "Delete product",
      message: `"${productName}" will be permanently deleted. Continue?`,
      tone: "danger",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result.success) {
        toast.success(result.message ?? "Deleted.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not delete.");
      }
    });
  }

  return (
    <button type="button" className="btn btn-sm btn-outline-danger" disabled={pending} onClick={handleClick}>
      ✕
    </button>
  );
}
