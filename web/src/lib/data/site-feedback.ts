import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// Ported from Services/SiteFeedbackService.cs.

export async function hasSubmittedFeedback(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const result = await admin.from("site_feedback").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return (result.count ?? 0) > 0;
}

export async function submitSiteFeedback(
  userId: string,
  rating: number,
  comment: string,
  fromWelcomePrompt: boolean
): Promise<{ success: boolean; message: string }> {
  if (rating < 1 || rating > 5) {
    return { success: false, message: "Please select a rating between 1 and 5 stars." };
  }

  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const fullName = (profileResult.data as { full_name: string } | null)?.full_name || "Customer";

  const insert: Database["public"]["Tables"]["site_feedback"]["Insert"] = {
    user_id: userId,
    author_name: fullName,
    rating,
    comment: comment.trim(),
    from_welcome_prompt: fromWelcomePrompt,
  };
  await admin.from("site_feedback").insert(insert);

  return { success: true, message: "Thank you for your feedback!" };
}
