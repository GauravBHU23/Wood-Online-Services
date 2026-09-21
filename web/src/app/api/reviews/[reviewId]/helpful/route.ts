import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { toggleHelpful } from "@/lib/data/reviews";

// Ported from Controllers/Api/ReviewApiController.cs#ToggleHelpful.
export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Please sign in first.", 401);

  const { reviewId } = await params;
  const id = Number(reviewId);
  if (!Number.isInteger(id) || id <= 0) return apiError("Review not found.", 404);

  const ok = await toggleHelpful(id, user.id);
  if (!ok) return apiError("Review not found.", 404);

  return apiSuccess(null);
}
