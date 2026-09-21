import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { answer } from "@/lib/chatbot/service";

const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "Please type your question.").max(200, "Please keep your question under 200 characters."),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Please type a shorter question.", 400);
  }

  const reply = await answer(parsed.data.message);
  return apiSuccess(reply);
}
