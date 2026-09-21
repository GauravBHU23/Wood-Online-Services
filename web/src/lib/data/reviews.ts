import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettingsFull, getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyNewReview } from "@/lib/email/service";
import type { Database } from "@/types/database";

// Ported from Services/ReviewService.cs. The average_rating/review_count denormalisation is
// handled by the reviews_recalc_rating DB trigger (0001_init_schema.sql), not re-computed here.

export type Review = Database["public"]["Tables"]["reviews"]["Row"];

export interface RatingBreakdown {
  stars: number;
  count: number;
  percentage: number;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  breakdown: RatingBreakdown[];
}

const PAGE_SIZE = 10;

export async function getReviewSummary(productId: number): Promise<ReviewSummary> {
  const supabase = await createClient();
  const result = await supabase.from("reviews").select("rating").eq("product_id", productId).eq("status", "approved");
  const rows: { rating: number }[] = result.data ?? [];

  const total = rows.length;
  const average = total === 0 ? 0 : Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / total) * 100) / 100;

  const breakdown: RatingBreakdown[] = [5, 4, 3, 2, 1].map((stars) => {
    const count = rows.filter((r) => r.rating === stars).length;
    const percentage = total === 0 ? 0 : Math.round((count * 100 * 10) / total) / 10;
    return { stars, count, percentage };
  });

  return { averageRating: average, totalReviews: total, breakdown };
}

export async function getApprovedReviews(productId: number, page = 1): Promise<Review[]> {
  const supabase = await createClient();
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const result = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("helpful_count", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  return result.data ?? [];
}

export async function getApprovedReviewCount(productId: number): Promise<number> {
  const supabase = await createClient();
  const result = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("status", "approved");
  return result.count ?? 0;
}

export async function getUserReview(productId: number, userId: string): Promise<Review | null> {
  const supabase = await createClient();
  const result = await supabase.from("reviews").select("*").eq("product_id", productId).eq("user_id", userId).maybeSingle();
  return (result.data as Review | null) ?? null;
}

/** A purchase counts only once the order reached a state where money is committed. */
export async function hasPurchased(productId: number, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const result = await admin
    .from("order_items")
    .select("id, order:orders!inner(user_id, order_status)")
    .eq("product_id", productId)
    .eq("order.user_id", userId)
    .neq("order.order_status", "cancelled")
    .limit(1);
  return (result.data?.length ?? 0) > 0;
}

export async function getVotedReviewIds(userId: string): Promise<number[]> {
  const admin = createAdminClient();
  const result = await admin.from("review_votes").select("review_id").eq("user_id", userId);
  const rows: { review_id: number }[] = result.data ?? [];
  return rows.map((r) => r.review_id);
}

export interface ReviewSubmitResult {
  success: boolean;
  message: string;
  requiresModeration: boolean;
}

export async function submitReview(
  productId: number,
  userId: string,
  rating: number,
  title: string | null,
  comment: string
): Promise<ReviewSubmitResult> {
  const settings = await getSiteSettingsFull();
  if (settings && !settings.feature_reviews) {
    return { success: false, message: "Reviews are currently disabled.", requiresModeration: false };
  }
  if (rating < 1 || rating > 5) {
    return { success: false, message: "Please select a rating between 1 and 5 stars.", requiresModeration: false };
  }

  const admin = createAdminClient();
  const productResult = await admin.from("products").select("id, name").eq("id", productId).maybeSingle();
  const product = productResult.data as { id: number; name: string } | null;
  if (!product) {
    return { success: false, message: "This product no longer exists.", requiresModeration: false };
  }

  const userResult = await admin.auth.admin.getUserById(userId);
  const authUser = userResult.data.user;
  if (!authUser) {
    return { success: false, message: "Please sign in to leave a review.", requiresModeration: false };
  }
  const profileResult = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const fullName = (profileResult.data as { full_name: string } | null)?.full_name || "Customer";

  const purchased = await hasPurchased(productId, userId);

  if (settings?.feature_require_purchase_to_review && !purchased) {
    return {
      success: false,
      message: "Only customers who have purchased this product can review it.",
      requiresModeration: false,
    };
  }

  const moderate = settings?.feature_moderate_reviews ?? true;
  const status: "approved" | "pending" = moderate ? "pending" : "approved";

  const existingResult = await admin.from("reviews").select("id").eq("product_id", productId).eq("user_id", userId).maybeSingle();
  const existing = existingResult.data as { id: number } | null;

  let reviewId: number;
  if (existing) {
    const patch: Database["public"]["Tables"]["reviews"]["Update"] = {
      rating,
      title: title?.trim() || null,
      comment: comment.trim(),
      is_verified_purchase: purchased,
      status,
      created_at: new Date().toISOString(),
      moderated_at: null,
    };
    await admin.from("reviews").update(patch).eq("id", existing.id);
    reviewId = existing.id;
  } else {
    const insert: Database["public"]["Tables"]["reviews"]["Insert"] = {
      product_id: productId,
      user_id: userId,
      author_name: fullName,
      rating,
      title: title?.trim() || null,
      comment: comment.trim(),
      is_verified_purchase: purchased,
      status,
    };
    const insertResult = await admin.from("reviews").insert(insert).select("id").single();
    reviewId = (insertResult.data as { id: number }).id;
  }

  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await notifyNewReview(
    toEmailConfig(site, siteBaseUrl),
    { rating, authorName: fullName, title: title?.trim() || null, comment: comment.trim(), status },
    product.name
  );

  void reviewId;

  return {
    success: true,
    message: moderate
      ? "Thank you! Your review has been submitted and will appear once approved."
      : "Thank you! Your review is now live.",
    requiresModeration: moderate,
  };
}

export async function toggleHelpful(reviewId: number, userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const reviewResult = await admin.from("reviews").select("id, helpful_count").eq("id", reviewId).maybeSingle();
  const review = reviewResult.data as { id: number; helpful_count: number } | null;
  if (!review) return false;

  const voteResult = await admin.from("review_votes").select("id").eq("review_id", reviewId).eq("user_id", userId).maybeSingle();
  const vote = voteResult.data as { id: number } | null;

  if (!vote) {
    const insert: Database["public"]["Tables"]["review_votes"]["Insert"] = { review_id: reviewId, user_id: userId };
    await admin.from("review_votes").insert(insert);
    const patch: Database["public"]["Tables"]["reviews"]["Update"] = { helpful_count: review.helpful_count + 1 };
    await admin.from("reviews").update(patch).eq("id", reviewId);
  } else {
    await admin.from("review_votes").delete().eq("id", vote.id);
    const patch: Database["public"]["Tables"]["reviews"]["Update"] = { helpful_count: Math.max(0, review.helpful_count - 1) };
    await admin.from("reviews").update(patch).eq("id", reviewId);
  }

  return true;
}
