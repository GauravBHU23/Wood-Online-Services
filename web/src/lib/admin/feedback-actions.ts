"use server";

import { revalidatePath } from "next/cache";
import { respondToFeedback, deleteAdminFeedback } from "@/lib/data/admin-feedback";
import type { ActionResult } from "@/lib/auth/types";

// Ported from Areas/Admin/Controllers/FeedbackController.cs.
export async function respondToFeedbackAction(id: number, adminResponse?: string): Promise<ActionResult> {
  const ok = await respondToFeedback(id, adminResponse);
  if (!ok) return { success: false, message: "Feedback not found." };

  revalidatePath("/admin/feedback");
  return { success: true, message: "Response saved." };
}

export async function deleteFeedbackAction(id: number): Promise<ActionResult> {
  const ok = await deleteAdminFeedback(id);
  if (!ok) return { success: false, message: "Feedback not found." };

  revalidatePath("/admin/feedback");
  return { success: true, message: "Feedback deleted." };
}
