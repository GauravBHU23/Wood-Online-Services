"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { StarRating } from "@/components/shop/star-rating";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { discountPercent } from "@/lib/utils/format";
import type { ProductWithCategory } from "@/lib/data/products";

// Every product in the catalogue required a full page navigation just to see a description or
// dimensions — this adds a "Quick View" without one, using the same product data the card
// already has (no extra fetch), for faster browsing through a long grid.

type QuickViewFn = (product: ProductWithCategory) => void;
const QuickViewContext = createContext<QuickViewFn | null>(null);

export function useQuickView(): QuickViewFn {
  const ctx = useContext(QuickViewContext);
  if (!ctx) throw new Error("useQuickView must be used within QuickViewProvider");
  return ctx;
}

export function QuickViewProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const open = useCallback<QuickViewFn>((p) => setProduct(p), []);
  const close = useCallback(() => setProduct(null), []);

  useEffect(() => {
    if (!product) return;
    closeRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [product, close]);

  const discount = product ? discountPercent(product.price, product.old_price) : 0;
  const inStock = product ? product.is_available && product.stock_quantity > 0 : false;

  return (
    <QuickViewContext.Provider value={open}>
      {children}
      {product && (
        <div className="quick-view-overlay" role="dialog" aria-modal="true" aria-label={`Quick view: ${product.name}`} onClick={close}>
          <div className="quick-view-panel" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="quick-view-close" onClick={close} aria-label="Close">
              ✕
            </button>

            <div className="row g-0">
              <div className="col-md-5">
                <div className="product-thumb-wrap" style={{ height: "100%", minHeight: 240 }}>
                  <img
                    src={product.image_url || "/img/cat-custom.svg"}
                    alt={product.name}
                    className="product-thumb"
                    loading="eager"
                  />
                </div>
              </div>

              <div className="col-md-7">
                <div className="p-4">
                  {product.wood_type && <span className="wood-chip mb-2 align-self-start">{product.wood_type}</span>}
                  <h2 className="mb-2" style={{ fontSize: "1.3rem" }}>
                    {product.name}
                  </h2>

                  {product.review_count > 0 && (
                    <div className="mb-2">
                      <StarRating value={product.average_rating} count={product.review_count} size=".9rem" showValue />
                    </div>
                  )}

                  {product.dimensions && <div className="small text-muted-wood mb-2">{product.dimensions}</div>}

                  {product.description && (
                    <p className="small text-muted-wood" style={{ whiteSpace: "pre-line" }}>
                      {product.description.length > 220 ? `${product.description.slice(0, 217)}...` : product.description}
                    </p>
                  )}

                  <div className="my-3">
                    {product.is_custom_order ? (
                      <span className="price" style={{ fontSize: "1.3rem" }}>
                        Price on request
                      </span>
                    ) : (
                      <>
                        <span className="price" style={{ fontSize: "1.3rem" }}>
                          ₹{Math.round(product.price).toLocaleString("en-IN")}
                        </span>
                        {product.old_price && product.old_price > product.price && (
                          <>
                            <span className="price-old">₹{Math.round(product.old_price).toLocaleString("en-IN")}</span>
                            {discount > 0 && <span className="badge badge-discount ms-2">{discount}% OFF</span>}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  <div className="d-flex flex-wrap gap-2">
                    {product.is_custom_order ? (
                      <Link href={`/contact?productId=${product.id}`} className="btn btn-wood" onClick={close}>
                        Request a Quote
                      </Link>
                    ) : inStock ? (
                      <AddToCartButton productId={product.id} />
                    ) : (
                      <Link href={`/contact?productId=${product.id}`} className="btn btn-outline-wood" onClick={close}>
                        Ask About Availability
                      </Link>
                    )}
                    <Link href={`/shop/${product.id}`} className="btn btn-outline-wood" onClick={close}>
                      View Full Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </QuickViewContext.Provider>
  );
}
