"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProductFeaturedAction } from "@/lib/admin/product-actions";
import { useToast } from "@/components/ui/toast-provider";

export function ToggleFeaturedButton({ productId, isFeatured }: { productId: number; isFeatured: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleClick() {
    startTransition(async () => {
      const result = await toggleProductFeaturedAction(productId);
      if (result.success) {
        toast.success(result.message ?? "Updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update.");
      }
    });
  }

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-wood"
      disabled={pending}
      onClick={handleClick}
      title={isFeatured ? "Remove from homepage" : "Show on homepage"}
    >
      {isFeatured ? "★" : "☆"}
    </button>
  );
}
