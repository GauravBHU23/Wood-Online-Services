"use server";

import { revalidatePath } from "next/cache";
import { removeFromCart, clearCart, getOrCreateCartKey, updateCartQuantity } from "@/lib/data/cart";

// Ported from Controllers/CartController.cs (Remove, Clear, Update) — the non-AJAX form actions;
// the AJAX equivalents live in app/api/cart/*.

export async function removeFromCartAction(productId: number) {
  await removeFromCart(productId);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function clearCartAction() {
  const { key } = await getOrCreateCartKey();
  await clearCart(key);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}

export async function updateCartQuantityAction(productId: number, quantity: number) {
  await updateCartQuantity(productId, quantity);
  revalidatePath("/cart");
  revalidatePath("/", "layout");
}
