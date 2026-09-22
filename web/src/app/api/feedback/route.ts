import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { siteFeedbackSchema } from "@/lib/validation/schemas";
import { submitSiteFeedback } from "@/lib/data/site-feedback";

// Ported from Controllers/Api/SiteFeedbackApiController.cs#Submit.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Please sign in to leave feedback.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400);
  }

  const parsed = siteFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Please check the form and try again.", 400);
  }

  const result = await submitSiteFeedback(user.id, parsed.data.rating, parsed.data.comment, parsed.data.fromWelcomePrompt ?? false);
  if (!result.success) return apiError(result.message, 400);

  return apiSuccess(null, result.message);
}
