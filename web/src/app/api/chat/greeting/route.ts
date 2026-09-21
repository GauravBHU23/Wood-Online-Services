import { apiSuccess } from "@/lib/api-response";
import { greeting } from "@/lib/chatbot/service";

export async function GET() {
  const reply = await greeting();
  return apiSuccess(reply);
}
