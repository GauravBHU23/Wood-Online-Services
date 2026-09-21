import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductById, getRelatedProducts } from "@/lib/data/products";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { createClient } from "@/lib/supabase/server";
import {
  getReviewSummary,
  getApprovedReviews,
  getApprovedReviewCount,
  getUserReview,
  hasPurchased,
  getVotedReviewIds,
} from "@/lib/data/reviews";
import { StarRating } from "@/components/shop/star-rating";
import { ProductCard } from "@/components/shop/product-card";
import { ReviewSection } from "@/components/shop/review-section";
import { InquiryForm } from "@/components/shop/inquiry-form";
import { AddToCartForm } from "@/components/shop/add-to-cart-form";
import { discountPercent } from "@/lib/utils/format";

interface PageParams {
  id: string;
}
interface PageSearchParams {
  reviewPage?: string;
}

// Ported from Controllers/ShopController.cs#Details + Views/Shop/Details.cshtml.
export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(Number(id));
  if (!product) return { title: "Product Not Found" };

  const description = product.description && product.description.length > 160 ? product.description.slice(0, 157) + "..." : product.description ?? undefined;

  return { title: product.name, description };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { id } = await params;
  const { reviewPage: reviewPageParam } = await searchParams;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const product = await getProductById(productId);
  if (!product) notFound();

  const reviewPage = Math.max(1, Number(reviewPageParam) || 1);

  const [site, related, summary, reviews, reviewCount] = await Promise.all([
    getSiteSettingsPublic(),
    getRelatedProducts(product.category_id, productId, 4),
    getReviewSummary(productId),
    getApprovedReviews(productId, reviewPage),
    getApprovedReviewCount(productId),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userReview = null;
  let userHasPurchased = false;
  let votedReviewIds: number[] = [];
  if (user) {
    [userReview, userHasPurchased, votedReviewIds] = await Promise.all([
      getUserReview(productId, user.id),
      hasPurchased(productId, user.id),
      getVotedReviewIds(user.id),
    ]);
  }

  const reviewTotalPages = Math.max(1, Math.ceil(reviewCount / 10));
  const discount = discountPercent(product.price, product.old_price);
  const inStock = product.is_available && product.stock_quantity > 0;
  const productDetailPath = `/shop/${productId}`;

  const waText = encodeURIComponent(`Hello, I would like more information about "${product.name}".`);
  const whatsappHref = `https://wa.me/${site.whatsapp_number}?text=${waText}`;

  const thumbs: string[] = [];
  if (product.image_url) thumbs.push(product.image_url);
  thumbs.push(...product.images.map((i) => i.image_path));

  return (
    <>
      <div className="bg-wood-50 border-bottom border-wood py-3">
        <div className="container">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb mb-0 small">
              <li className="breadcrumb-item">
                <Link href="/">Home</Link>
              </li>
              <li className="breadcrumb-item">
                <Link href="/shop">Products</Link>
              </li>
              {product.category && (
                <li className="breadcrumb-item">
                  <Link href={`/shop?categoryId=${product.category_id}`}>{product.category.name}</Link>
                </li>
              )}
              <li className="breadcrumb-item active" aria-current="page">
                {product.name}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4">
          <div className="col-lg-6">
            <img
              id="mainImage"
              src={product.image_url || "/img/cat-custom.svg"}
              alt={product.name}
              className="gallery-main mb-3"
              width={600}
              height={450}
            />

            {thumbs.length > 1 && (
              <div className="d-flex gap-2 flex-wrap">
                {thumbs.map((src, i) => (
                  <img key={i} src={src} alt={`${product.name} view ${i + 1}`} className={`gallery-thumb${i === 0 ? " active" : ""}`} loading="lazy" />
                ))}
              </div>
            )}
          </div>

          <div className="col-lg-6">
            <div className="d-flex flex-wrap gap-2 mb-2">
              {product.is_custom_order && <span className="badge badge-custom">Custom Order</span>}
              {product.is_featured && <span className="badge badge-wood">Featured</span>}
              {discount > 0 && <span className="badge badge-discount">{discount}% OFF</span>}
            </div>

            <h1 className="mb-2">{product.name}</h1>

            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              {product.wood_type && <span className="wood-chip">{product.wood_type}</span>}

              {product.review_count > 0 ? (
                <a href="#reviews" className="text-decoration-none">
                  <StarRating value={product.average_rating} count={product.review_count} size=".95rem" />
                </a>
              ) : (
                <a href="#reviews" className="small text-muted-wood">
                  Be the first to review
                </a>
              )}
            </div>

            <div className="my-3">
              {product.is_custom_order ? (
                <>
                  <div className="price" style={{ fontSize: "1.4rem" }}>
                    Price on request
                  </div>
                  <p className="small text-muted-wood mb-0">
                    This item is made to your measurements and design. Send us an inquiry and we will prepare a quotation for you.
                  </p>
                </>
              ) : (
                <>
                  <span className="price" style={{ fontSize: "2rem" }}>
                    ₹{Math.round(product.price).toLocaleString("en-IN")}
                  </span>
                  {product.old_price && product.old_price > product.price && (
                    <>
                      <span className="price-old" style={{ fontSize: "1.1rem" }}>
                        ₹{Math.round(product.old_price).toLocaleString("en-IN")}
                      </span>
                      <span className="badge badge-discount ms-2">Save ₹{Math.round(product.old_price - product.price).toLocaleString("en-IN")}</span>
                    </>
                  )}

                  <div className="mt-2">
                    {inStock ? (
                      <>
                        <span className="text-success fw-bold">In Stock</span>
                        {product.stock_quantity <= 3 && <span className="text-danger small ms-2">Only {product.stock_quantity} left!</span>}
                      </>
                    ) : (
                      <span className="text-danger fw-bold">Out of Stock</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="my-4">
              {product.is_custom_order || !inStock ? (
                <div className="d-flex flex-wrap gap-2">
                  <Link href={`/contact?productId=${productId}`} className="btn btn-wood btn-lg">
                    {product.is_custom_order ? "Request a Quote" : "Ask About Availability"}
                  </Link>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg">
                    WhatsApp
                  </a>
                </div>
              ) : (
                <AddToCartForm productId={productId} maxQuantity={product.stock_quantity} whatsappHref={whatsappHref} />
              )}
            </div>

            <div className="panel mb-3">
              <div className="panel-header">Specifications</div>
              <div className="table-wrap">
                <table className="table table-sm spec-table mb-0">
                  <tbody>
                    {product.category && (
                      <tr>
                        <th>Category</th>
                        <td>{product.category.name}</td>
                      </tr>
                    )}
                    {product.wood_type && (
                      <tr>
                        <th>Wood Type</th>
                        <td>{product.wood_type}</td>
                      </tr>
                    )}
                    {product.dimensions && (
                      <tr>
                        <th>Dimensions (L&times;W&times;H)</th>
                        <td>{product.dimensions}</td>
                      </tr>
                    )}
                    {!product.is_custom_order && (
                      <tr>
                        <th>Availability</th>
                        <td>{inStock ? `${product.stock_quantity} available` : "Out of stock"}</td>
                      </tr>
                    )}
                    <tr>
                      <th>Finish</th>
                      <td>Natural, Walnut or Mahogany — your choice</td>
                    </tr>
                    <tr>
                      <th>Delivery</th>
                      <td>
                        Free above ₹{Math.round(site.free_shipping_above).toLocaleString("en-IN")}, otherwise ₹
                        {Math.round(site.shipping_charge).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {product.description && (
              <div className="panel">
                <div className="panel-header">About This Product</div>
                <div className="panel-body">
                  <p className="mb-0" style={{ whiteSpace: "pre-line" }}>
                    {product.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="row mt-5">
          <div className="col-lg-10 mx-auto">
            <ReviewSection
              productId={productId}
              productDetailPath={productDetailPath}
              summary={summary}
              reviews={reviews}
              reviewPage={reviewPage}
              reviewTotalPages={reviewTotalPages}
              isSignedIn={!!user}
              userReview={userReview}
              userHasPurchased={userHasPurchased}
              votedReviewIds={votedReviewIds}
            />
          </div>
        </div>

        <div className="row mt-4">
          <div className="col-lg-8 mx-auto">
            <div className="panel">
              <div className="panel-header">Have a Question About This Product?</div>
              <div className="panel-body">
                <InquiryForm productId={productId} defaultMessage={`I would like more information about "${product.name}". `} />
              </div>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-5">
            <h2 className="section-title">You May Also Like</h2>
            <div className="row g-3 g-md-4">
              {related.map((p) => (
                <div key={p.id} className="col-6 col-md-3">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
