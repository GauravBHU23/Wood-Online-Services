import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCartKey } from "@/lib/data/cart";
import type { Database, OrderStatus as DbOrderStatus } from "@/types/database";
import type { AddressInput } from "@/lib/validation/schemas";

// Ported from Services/OrderService.cs. Order placement itself runs as one Postgres function
// (place_order, migration 0005) rather than multiple round-trips, so a crash mid-checkout can
// never half-apply — see that migration's comment for why.

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderWithItems = Order & { items: OrderItem[] };
export type OrderStatus = DbOrderStatus;

export class PlaceOrderError extends Error {}

export async function placeOrder(
  userId: string,
  address: AddressInput,
  paymentMethod: "cod" | "online"
): Promise<Order> {
  const { key: cartKey } = await getCartKey();
  const admin = createAdminClient();

  const result = await admin.rpc("place_order", {
    p_user_id: userId,
    p_cart_key: cartKey,
    p_shipping_name: address.shippingName.trim(),
    p_shipping_phone: address.shippingPhone.trim(),
    p_shipping_address: address.shippingAddress.trim(),
    p_shipping_city: address.shippingCity.trim(),
    p_shipping_state: address.shippingState.trim(),
    p_shipping_pin_code: address.shippingPinCode.trim(),
    p_notes: address.notes?.trim() || null,
    p_payment_method: paymentMethod,
  });

  if (result.error) {
    // Postgres errors raised with errcode P0001 (RAISE EXCEPTION) carry the friendly message
    // written in place_order() itself (out of stock, empty cart, etc.) in result.error.message.
    throw new PlaceOrderError(result.error.message || "Could not place your order. Please try again.");
  }

  return result.data as Order;
}

export async function getOrderById(orderId: number, userId: string): Promise<OrderWithItems | null> {
  const supabase = await createClient();
  const result = await supabase.from("orders").select("*, items:order_items(*)").eq("id", orderId).eq("user_id", userId).maybeSingle();
  return (result.data as OrderWithItems | null) ?? null;
}

export async function getOrderByNumber(orderNumber: string, userId: string): Promise<OrderWithItems | null> {
  const supabase = await createClient();
  const result = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("order_number", orderNumber)
    .eq("user_id", userId)
    .maybeSingle();
  return (result.data as OrderWithItems | null) ?? null;
}

export async function getUserOrders(userId: string): Promise<Order[]> {
  const supabase = await createClient();
  const result = await supabase.from("orders").select("*").eq("user_id", userId).order("order_date", { ascending: false });
  return result.data ?? [];
}

/** Cancellation with automatic stock return, ported from Controllers/OrdersController.cs#Cancel. */
export async function cancelOrder(orderId: number, userId: string): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient();

  const orderResult = await admin.from("orders").select("*, items:order_items(*)").eq("id", orderId).eq("user_id", userId).maybeSingle();
  const order = orderResult.data as OrderWithItems | null;
  if (!order) return { success: false, message: "We could not find that order." };

  if (order.order_status === "cancelled") return { success: false, message: "This order is already cancelled." };
  if (order.order_status === "shipped" || order.order_status === "delivered") {
    return { success: false, message: "This order has already been dispatched and cannot be cancelled online. Please contact us." };
  }

  const statusPatch: Database["public"]["Tables"]["orders"]["Update"] = { order_status: "cancelled" };
  await admin.from("orders").update(statusPatch).eq("id", orderId);

  for (const item of order.items) {
    const productResult = await admin.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle();
    const product = productResult.data as { stock_quantity: number } | null;
    if (product) {
      const patch: Database["public"]["Tables"]["products"]["Update"] = { stock_quantity: product.stock_quantity + item.quantity };
      await admin.from("products").update(patch).eq("id", item.product_id);
    }
  }

  return { success: true, message: "Your order has been cancelled." };
}
