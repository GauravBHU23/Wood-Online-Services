import Link from "next/link";
import type { ProductWithCategory } from "@/lib/data/products";
import { StarRating } from "@/components/shop/star-rating";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { discountPercent } from "@/lib/utils/format";

// Ported from Views/Shared/_ProductCard.cshtml — same classes/markup (.card-wood, .product-thumb,
// .badge-custom/.badge-discount/.badge-wood, .wood-chip, .price/.price-old).
export function ProductCard({ product }: { product: ProductWithCategory }) {
  const discount = discountPercent(product.price, product.old_price);
  const inStock = product.is_available && product.stock_quantity > 0;

  return (
    <div className="card-wood d-flex flex-column h-100">
      <Link href={`/shop/${product.id}`} className="position-relative d-block" aria-label={product.name}>
        <img
          src={product.image_url || "/img/cat-custom.svg"}
          alt={product.name}
          className="product-thumb"
          loading="lazy"
          decoding="async"
          width={400}
          height={300}
        />

        <div className="position-absolute top-0 start-0 m-2 d-flex flex-column gap-1 align-items-start">
          {product.is_custom_order ? (
            <span className="badge badge-custom">Custom Order</span>
          ) : discount > 0 ? (
            <span className="badge badge-discount">{discount}% OFF</span>
          ) : null}
          {product.is_featured && <span className="badge badge-wood">Featured</span>}
        </div>

        {!product.is_custom_order && !inStock && (
          <span className="badge bg-secondary position-absolute top-0 end-0 m-2">Out of Stock</span>
        )}
      </Link>

      <div className="p-3 d-flex flex-column flex-grow-1">
        {product.wood_type && <span className="wood-chip mb-2 align-self-start">{product.wood_type}</span>}

        <h3 className="product-title">
          <Link href={`/shop/${product.id}`} className="text-decoration-none" style={{ color: "inherit" }}>
            {product.name}
          </Link>
        </h3>

        {product.review_count > 0 && (
          <div className="mb-2">
            <StarRating value={product.average_rating} count={product.review_count} size=".85rem" showValue showCount={false} />
          </div>
        )}

        {product.dimensions && <div className="small text-muted-wood mb-2">{product.dimensions}</div>}

        <div className="mt-auto pt-2">
          {product.is_custom_order ? (
            <>
              <div className="mb-2">
                <span className="price" style={{ fontSize: "1rem" }}>
                  Price on request
                </span>
              </div>
              <Link href={`/contact?productId=${product.id}`} className="btn btn-outline-wood btn-sm w-100">
                Request a Quote
              </Link>
            </>
          ) : (
            <>
              <div className="mb-2">
                <span className="price">₹{Math.round(product.price).toLocaleString("en-IN")}</span>
                {product.old_price && product.old_price > product.price && (
                  <span className="price-old">₹{Math.round(product.old_price).toLocaleString("en-IN")}</span>
                )}
              </div>

              {inStock ? (
                <AddToCartButton productId={product.id} />
              ) : (
                <Link href={`/contact?productId=${product.id}`} className="btn btn-outline-wood btn-sm w-100">
                  Ask About Availability
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
