import { StarRating } from "@/components/shop/star-rating";
import type { Testimonial } from "@/lib/data/reviews";

export function TestimonialCard({ review }: { review: Testimonial }) {
  const initial = review.author_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="testimonial-card h-100">
      <StarRating value={review.rating} showCount={false} showValue={false} size="0.85rem" />
      <p className="testimonial-comment">&ldquo;{review.comment}&rdquo;</p>
      <div className="testimonial-footer">
        <span className="testimonial-avatar">{initial}</span>
        <div>
          <div className="testimonial-name">
            {review.author_name}
            {review.is_verified_purchase && <span className="testimonial-verified">Verified Buyer</span>}
          </div>
          {review.product_name && <div className="testimonial-product">{review.product_name}</div>}
        </div>
      </div>
    </div>
  );
}
