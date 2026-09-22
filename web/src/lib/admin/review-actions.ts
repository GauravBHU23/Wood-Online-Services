"use server";

import { revalidatePath } from "next/cache";
import { updateAdminReviewStatus, deleteAdminReview } from "@/lib/data/admin-reviews";
import type { ActionResult } from "@/lib/auth/types";
import type { ReviewStatus } from "@/types/database";

// Ported from Areas/Admin/Controllers/ReviewsController.cs.
export async function updateReviewStatusAction(id: number, status: ReviewStatus, adminResponse?: string): Promise<ActionResult> {
  const ok = await updateAdminReviewStatus(id, status, adminResponse);
  if (!ok) return { success: false, message: "Review not found." };

  revalidatePath("/admin/reviews");
  revalidatePath("/shop", "layout");
  return { success: true, message: `Review has been ${status}.` };
}

export async function deleteReviewAction(id: number): Promise<ActionResult> {
  const ok = await deleteAdminReview(id);
  if (!ok) return { success: false, message: "Review not found." };

  revalidatePath("/admin/reviews");
  revalidatePath("/shop", "layout");
  return { success: true, message: "Review deleted." };
}
