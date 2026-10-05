"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/shop/product-card";
import { readViewedIds } from "@/lib/client/recently-viewed";
import type { ProductWithCategory } from "@/lib/data/products";

/**
 * A classic e-commerce feature that was missing entirely — a strip of products the visitor
 * looked at recently, driven purely by localStorage (no account needed). Excludes the product
 * currently being viewed so a product detail page doesn't show itself in its own strip.
 *
 * `standalone` (default) renders its own full-width <section><div className="container"> — for
 * placing directly between other homepage sections. Pass `standalone={false}` when already inside
 * a page's own .container (e.g. the product detail page), to avoid nesting containers.
 */
export function RecentlyViewed({
  excludeId,
  standalone = true,
}: {
  excludeId?: number;
  standalone?: boolean;
}) {
  const [products, setProducts] = useState<ProductWithCategory[] | null>(null);

  useEffect(() => {
    const ids = readViewedIds().filter((id) => id !== excludeId);
    if (ids.length === 0) return;
    fetch(`/api/products/by-ids?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((json) => setProducts(json.success ? json.data : []))
      .catch(() => setProducts([]));
  }, [excludeId]);

  if (!products || products.length === 0) return null;

  const content = (
    <>
      <h2 className="section-title">Recently Viewed</h2>
      <div className="row g-3 g-md-4">
        {products.slice(0, 4).map((p) => (
          <div key={p.id} className="col-6 col-md-3">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </>
  );

  if (!standalone) return <div className="mt-5">{content}</div>;

  return (
    <section className="py-5">
      <div className="container">{content}</div>
    </section>
  );
}
