import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { hasSubmittedFeedback } from "@/lib/data/site-feedback";

// Ported from Controllers/Api/SiteFeedbackApiController.cs#Eligibility.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Please sign in first.", 401);

  const hasSubmitted = await hasSubmittedFeedback(user.id);
  return apiSuccess({ hasSubmitted });
}
