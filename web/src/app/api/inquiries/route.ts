import { apiSuccess, apiError } from "@/lib/api-response";
import { inquirySchema } from "@/lib/validation/schemas";
import { createInquiry } from "@/lib/data/inquiries";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400);
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Please correct the highlighted fields and try again.", 400);
  }

  await createInquiry(parsed.data);
  return apiSuccess(null, "Thank you! We have received your message and will contact you shortly.");
}
