import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { addToCart, getCartCount } from "@/lib/data/cart";

// Ported from Controllers/CartController.cs#AddAjax — same shape, no page reload.
const schema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid request body.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid product.", 400);
  }

  try {
    await addToCart(parsed.data.productId, parsed.data.quantity);
    const cartCount = await getCartCount();
    return apiSuccess({ cartCount }, "Added to your cart.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "We could not add that item. Please try again.";
    return apiError(message, 400);
  }
}
