"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCart } from "@/lib/data/cart";
import { placeOrder, PlaceOrderError } from "@/lib/data/orders";
import { createTransaction, updateTransaction, getTransactionByRequestId } from "@/lib/payments/transactions";
import * as cashfree from "@/lib/payments/cashfree";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/schemas";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyOrderPlaced, notifyPaymentSuccess, notifyPaymentFailed } from "@/lib/email/service";
import type { Database } from "@/types/database";
import type { Order } from "@/lib/data/orders";
import { enforceSensitiveRateLimit } from "@/lib/rate-limit";

// Ported from Controllers/CheckoutController.cs.

export interface PlaceOrderResult {
  success: boolean;
  message?: string;
  orderNumber?: string;
  orderId?: number;
  /** Set when online payment starts and the customer must be sent to the gateway. */
  redirectTo?: string;
}

async function toEmailOrder(order: Order) {
  const admin = createAdminClient();
  const itemsResult = await admin.from("order_items").select("product_name, unit_price, quantity").eq("order_id", order.id);
  return {
    id: order.id,
    order_number: order.order_number,
    payment_method: order.payment_method,
    notes: order.notes,
    shipping_name: order.shipping_name,
    shipping_address: order.shipping_address,
    shipping_city: order.shipping_city,
    shipping_state: order.shipping_state,
    shipping_pin_code: order.shipping_pin_code,
    shipping_phone: order.shipping_phone,
    sub_total: order.sub_total,
    shipping_charge: order.shipping_charge,
    total_amount: order.total_amount,
    items: itemsResult.data ?? [],
  };
}

export async function placeOrderAction(
  input: CheckoutInput,
  saveAddress: boolean
): Promise<PlaceOrderResult> {
  const limited = await enforceSensitiveRateLimit();
  if (limited) return limited;

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Please correct the highlighted fields and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Please sign in to place an order." };

  const cart = await getCart();
  if (cart.isEmpty) return { success: false, message: "Your cart is empty." };

  // Never let a client select online payment when the gateway cannot actually take it.
  if (parsed.data.paymentMethod === "online" && !cashfree.isUsable()) {
    return { success: false, message: "Online payment is unavailable right now. Please choose Cash on Delivery." };
  }

  if (saveAddress) {
    const admin = createAdminClient();
    const patch: Database["public"]["Tables"]["profiles"]["Update"] = {
      address: parsed.data.shippingAddress.trim(),
      city: parsed.data.shippingCity.trim(),
      state: parsed.data.shippingState.trim(),
      pin_code: parsed.data.shippingPinCode.trim(),
    };
    await admin.from("profiles").update(patch).eq("id", user.id);
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, phone: parsed.data.shippingPhone.trim() },
    });
  }

  let order: Order;
  try {
    order = await placeOrder(user.id, parsed.data, parsed.data.paymentMethod);
  } catch (err) {
    if (err instanceof PlaceOrderError) {
      return { success: false, message: err.message };
    }
    return { success: false, message: "Could not place your order. Please try again." };
  }

  if (order.payment_method === "cod") {
    const site = await getSiteSettingsPublic();
    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await notifyOrderPlaced(toEmailConfig(site, siteBaseUrl), await toEmailOrder(order), user.email ?? null);

    return { success: true, orderNumber: order.order_number, orderId: order.id, redirectTo: `/checkout/success?orderNumber=${order.order_number}` };
  }

  return startOnlinePayment(order, user.email ?? "", user.user_metadata?.full_name as string | undefined);
}

async function startOnlinePayment(order: Order, email: string, fullName?: string): Promise<PlaceOrderResult> {
  const transaction = await createTransaction(order.id, order.total_amount);

  const result = await cashfree.createPaymentRequest(
    { orderNumber: order.order_number, totalAmount: order.total_amount, userId: order.user_id },
    fullName || order.shipping_name,
    email,
    order.shipping_phone
  );

  if (!result.success || !result.paymentUrl) {
    await updateTransaction(transaction.id, { status: "failed", failure_reason: result.errorMessage });
    const admin = createAdminClient();
    const patch: Database["public"]["Tables"]["orders"]["Update"] = { payment_status: "failed" };
    await admin.from("orders").update(patch).eq("id", order.id);

    console.error(`Could not start payment for ${order.order_number}: ${result.errorMessage}`);

    return {
      success: false,
      message: result.errorMessage ?? "We could not start the payment. Your order is saved — you can retry payment from your orders page.",
      redirectTo: `/orders/${order.id}`,
    };
  }

  await updateTransaction(transaction.id, {
    payment_request_id: result.paymentRequestId,
    payment_url: result.paymentUrl,
    status: "pending",
  });

  if (cashfree.isSimulated()) {
    return { success: true, redirectTo: `/checkout/simulated-gateway?requestId=${result.paymentRequestId}` };
  }

  // Cashfree's hosted checkout is launched by its JS SDK, not a plain HTTP redirect, so the
  // customer is handed to a thin page that opens it with this payment_session_id.
  return {
    success: true,
    redirectTo: `/checkout/gateway-redirect?sessionId=${encodeURIComponent(result.paymentUrl)}&clientId=${encodeURIComponent(cashfree.getClientId())}`,
  };
}

export interface SimulatedOutcomeResult {
  success: boolean;
  message: string;
  redirectTo: string;
}

export async function applySimulatedOutcomeAction(requestId: string, outcome: "success" | "fail", method?: string): Promise<SimulatedOutcomeResult> {
  const limited = await enforceSensitiveRateLimit();
  if (limited) return { ...limited, redirectTo: "/orders" };

  if (!cashfree.isSimulated()) return { success: false, message: "Not available.", redirectTo: "/orders" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Please sign in again.", redirectTo: "/account/login" };

  const transaction = await getTransactionByRequestId(requestId);
  if (!transaction) return { success: false, message: "We could not find that payment.", redirectTo: "/orders" };

  const admin = createAdminClient();
  const orderResult = await admin.from("orders").select("*").eq("id", transaction.order_id).maybeSingle();
  const order = orderResult.data as Order | null;

  if (!order || order.user_id !== user.id) return { success: false, message: "We could not find that payment.", redirectTo: "/orders" };

  // A settled transaction must not be reopened by re-posting this form.
  if (transaction.status === "success") {
    return { success: true, message: "Payment successful. Thank you!", redirectTo: `/checkout/success?orderNumber=${order.order_number}` };
  }

  const succeeded = outcome === "success";
  const simulatedPaymentMethod = method ? `${method} (simulated)` : "UPI (simulated)";
  const simulatedPaymentId = succeeded ? "SIMPAY-" + Math.random().toString(36).slice(2, 14).toUpperCase() : null;

  await updateTransaction(transaction.id, {
    payment_method: simulatedPaymentMethod,
    completed_at: new Date().toISOString(),
    is_webhook_verified: true,
    gateway_response: "Simulated payment, outcome chosen by the customer.",
    status: succeeded ? "success" : "failed",
    payment_id: simulatedPaymentId,
    failure_reason: succeeded ? null : "Payment cancelled on the gateway.",
  });

  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const emailConfig = toEmailConfig(site, siteBaseUrl);

  if (succeeded) {
    const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = {
      payment_status: "paid",
      // The real generated id (e.g. SIMPAY-A1B2C3D4E5F6), not the literal string "SIMPAY" —
      // matches CheckoutController.cs passing the real transaction through to the success email
      // and persisted reference, rather than a placeholder.
      payment_reference: simulatedPaymentId ?? "SIMPAY",
      ...(order.order_status === "pending" ? { order_status: "confirmed" as const } : {}),
    };
    await admin.from("orders").update(orderPatch).eq("id", order.id);

    const emailOrder = await toEmailOrder(order);
    await notifyOrderPlaced(emailConfig, emailOrder, user.email ?? null);
    await notifyPaymentSuccess(
      emailConfig,
      emailOrder,
      { amount: order.total_amount, payment_method: simulatedPaymentMethod, payment_id: simulatedPaymentId, failure_reason: null },
      user.email ?? null
    );

    return { success: true, message: "Payment successful. Thank you!", redirectTo: `/checkout/success?orderNumber=${order.order_number}` };
  }

  const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = { payment_status: "failed" };
  await admin.from("orders").update(orderPatch).eq("id", order.id);

  await notifyPaymentFailed(
    emailConfig,
    await toEmailOrder(order),
    { amount: order.total_amount, payment_method: null, payment_id: null, failure_reason: "Payment cancelled on the gateway." },
    user.email ?? null
  );

  return {
    success: false,
    message: "Your payment was not completed. No amount has been charged. You can retry from your order page.",
    redirectTo: `/orders/${order.id}`,
  };
}

export async function retryPaymentAction(orderId: number): Promise<PlaceOrderResult> {
  const limited = await enforceSensitiveRateLimit();
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Please sign in again." };

  const admin = createAdminClient();
  const orderResult = await admin.from("orders").select("*").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  const order = orderResult.data as Order | null;

  if (!order) return { success: false, message: "We could not find that order." };
  if (order.payment_status === "paid") return { success: false, message: "This order is already paid." };
  if (order.order_status === "cancelled") return { success: false, message: "This order has been cancelled and cannot be paid." };
  if (!cashfree.isUsable()) return { success: false, message: "Online payment is unavailable right now. Please contact us to complete this order." };

  return startOnlinePayment(order, user.email ?? "", user.user_metadata?.full_name as string | undefined);
}
