"use client";

import { useQuickView } from "@/components/shop/quick-view-modal";
import type { ProductWithCategory } from "@/lib/data/products";

export function QuickViewButton({ product }: { product: ProductWithCategory }) {
  const openQuickView = useQuickView();

  return (
    <button
      type="button"
      className="quick-view-trigger"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openQuickView(product);
      }}
    >
      Quick View
    </button>
  );
}
