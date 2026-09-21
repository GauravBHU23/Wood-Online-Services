import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";
import { reviewSchema } from "@/lib/validation/schemas";
import { submitReview } from "@/lib/data/reviews";

// Ported from Controllers/Api/ReviewApiController.cs#Submit.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Please sign in to leave a review.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400);
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Please check the form and try again.", 400);
  }

  const result = await submitReview(
    parsed.data.productId,
    user.id,
    parsed.data.rating,
    parsed.data.title ?? null,
    parsed.data.comment
  );

  if (!result.success) return apiError(result.message, 400);

  return apiSuccess({ requiresModeration: result.requiresModeration }, result.message);
}
