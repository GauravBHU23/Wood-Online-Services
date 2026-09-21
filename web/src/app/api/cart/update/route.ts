import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-response";
import { updateCartQuantity, getCart } from "@/lib/data/cart";

// Ported from Controllers/CartController.cs#UpdateAjax.
const schema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0).max(50),
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
    return apiError("Invalid request.", 400);
  }

  try {
    await updateCartQuantity(parsed.data.productId, parsed.data.quantity);
    const cart = await getCart();
    return apiSuccess({
      cartCount: cart.itemCount,
      subTotal: cart.subTotal,
      shipping: cart.shippingCharge,
      total: cart.total,
      isEmpty: cart.isEmpty,
    });
  } catch {
    return apiError("We could not update the quantity. Please try again.", 400);
  }
}
