import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// Ported from Areas/Admin/Controllers/FeedbackController.cs.

export type SiteFeedback = Database["public"]["Tables"]["site_feedback"]["Row"];

export interface AdminFeedbackListResult {
  items: SiteFeedback[];
  totalCount: number;
  page: number;
  pageSize: number;
  averageRating: number;
}

const PAGE_SIZE = 20;

export async function getAdminFeedback(filters: { search?: string; page?: number }): Promise<AdminFeedbackListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = admin.from("site_feedback").select("*", { count: "exact" });
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`author_name.ilike.%${term}%,comment.ilike.%${term}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.order("created_at", { ascending: false }).range(from, to);

  const [result, ratingsResult] = await Promise.all([query, admin.from("site_feedback").select("rating")]);

  const ratings: { rating: number }[] = ratingsResult.data ?? [];
  const averageRating = ratings.length === 0 ? 0 : Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 100) / 100;

  return {
    items: result.data ?? [],
    totalCount: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    averageRating,
  };
}

export async function respondToFeedback(id: number, adminResponse?: string): Promise<boolean> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["site_feedback"]["Update"] = { admin_response: adminResponse?.trim() || null };
  const result = await admin.from("site_feedback").update(patch).eq("id", id).select("id").maybeSingle();
  return !!result.data;
}

export async function deleteAdminFeedback(id: number): Promise<boolean> {
  const admin = createAdminClient();
  const result = await admin.from("site_feedback").delete().eq("id", id).select("id").maybeSingle();
  return !!result.data;
}
