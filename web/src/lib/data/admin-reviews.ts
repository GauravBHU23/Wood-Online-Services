import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, ReviewStatus } from "@/types/database";
import type { Review } from "@/lib/data/reviews";

// Ported from Areas/Admin/Controllers/ReviewsController.cs.

export type AdminReview = Review & { product: { id: number; name: string } | null };

export interface AdminReviewListResult {
  items: AdminReview[];
  totalCount: number;
  page: number;
  pageSize: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

const PAGE_SIZE = 20;

export async function getAdminReviews(filters: { status?: string; search?: string; page?: number }): Promise<AdminReviewListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = admin.from("reviews").select("*, product:products(id, name)", { count: "exact" });

  const validStatuses = ["pending", "approved", "rejected"];
  if (filters.status && validStatuses.includes(filters.status)) {
    query = query.eq("status", filters.status as ReviewStatus);
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`author_name.ilike.%${term}%,comment.ilike.%${term}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  // Pending first, so moderation is the default view.
  query = query.order("status", { ascending: true }).order("created_at", { ascending: false }).range(from, to);

  const [result, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    query,
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "approved").then((r) => r.count ?? 0),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "rejected").then((r) => r.count ?? 0),
  ]);

  return {
    items: (result.data ?? []) as unknown as AdminReview[],
    totalCount: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pendingCount,
    approvedCount,
    rejectedCount,
  };
}

export async function updateAdminReviewStatus(id: number, status: ReviewStatus, adminResponse?: string): Promise<boolean> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["reviews"]["Update"] = { status, moderated_at: new Date().toISOString() };
  if (adminResponse !== undefined) patch.admin_response = adminResponse.trim() || null;

  const result = await admin.from("reviews").update(patch).eq("id", id).select("id").maybeSingle();
  // average_rating/review_count refresh automatically via the reviews_recalc_rating DB trigger.
  return !!result.data;
}

export async function deleteAdminReview(id: number): Promise<boolean> {
  const admin = createAdminClient();
  const result = await admin.from("reviews").delete().eq("id", id).select("id").maybeSingle();
  // The trigger recalculates the product's rating on delete too.
  return !!result.data;
}
