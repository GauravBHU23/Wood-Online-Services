"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTransactionByRequestId, updateTransaction } from "@/lib/payments/transactions";
import * as cashfree from "@/lib/payments/cashfree";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyOrderPlaced, notifyPaymentSuccess, notifyPaymentFailed } from "@/lib/email/service";
import type { Database } from "@/types/database";
import type { Order } from "@/lib/data/orders";

// Ported from Controllers/CheckoutController.cs#PaymentCallback. Where Cashfree sends the
// customer's browser after payment. This is only a hint — the webhook is the authority. We
// verify with the API before trusting anything here, because these query values arrive through
// the customer's own browser.

export interface PaymentCallbackResult {
  status: "success" | "pending" | "failed" | "not_found";
  message: string;
  redirectTo: string;
}

export async function handlePaymentCallback(orderIdParam: string | null): Promise<PaymentCallbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!orderIdParam) {
    return { status: "not_found", message: "We could not identify that payment.", redirectTo: "/orders" };
  }

  const transaction = await getTransactionByRequestId(orderIdParam);
  if (!transaction) {
    return { status: "not_found", message: "We could not find that order.", redirectTo: "/orders" };
  }

  const admin = createAdminClient();
  const orderResult = await admin.from("orders").select("*").eq("id", transaction.order_id).maybeSingle();
  const order = orderResult.data as Order | null;

  if (!order || (user && order.user_id !== user.id)) {
    return { status: "not_found", message: "We could not find that order.", redirectTo: "/orders" };
  }

  // The webhook may already have settled this; if so just show the result.
  if (transaction.status === "success") {
    return { status: "success", message: "Payment successful. Thank you!", redirectTo: `/checkout/success?orderNumber=${order.order_number}` };
  }

  // Ask Cashfree directly rather than trusting the query string.
  const status = await cashfree.getPaymentStatus(orderIdParam);
  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const emailConfig = toEmailConfig(site, siteBaseUrl);

  const itemsResult = await admin.from("order_items").select("product_name, unit_price, quantity").eq("order_id", order.id);
  const emailOrder = {
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

  if (status.success && status.status === "success") {
    await updateTransaction(transaction.id, {
      status: "success",
      payment_id: status.paymentId,
      payment_method: status.paymentMethod,
      completed_at: new Date().toISOString(),
      gateway_response: status.rawResponse,
    });

    const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = {
      payment_status: "paid",
      payment_reference: status.paymentId,
      ...(order.order_status === "pending" ? { order_status: "confirmed" as const } : {}),
    };
    await admin.from("orders").update(orderPatch).eq("id", order.id);

    await notifyOrderPlaced(emailConfig, emailOrder, user?.email ?? null);
    await notifyPaymentSuccess(emailConfig, emailOrder, { amount: order.total_amount, payment_method: status.paymentMethod, payment_id: status.paymentId, failure_reason: null }, user?.email ?? null);

    console.log(`Payment verified on callback for ${order.order_number}`);
    return { status: "success", message: "Payment successful. Thank you!", redirectTo: `/checkout/success?orderNumber=${order.order_number}` };
  }

  if (status.success && status.status === "pending") {
    // Some UPI apps confirm minutes later; the order page polls for the webhook.
    return { status: "pending", message: "Your payment is still being confirmed. This page will update automatically.", redirectTo: `/orders/${order.id}?awaiting=true` };
  }

  await updateTransaction(transaction.id, {
    status: "failed",
    failure_reason: status.failureReason ?? "Payment was not completed.",
    completed_at: new Date().toISOString(),
  });
  const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = { payment_status: "failed" };
  await admin.from("orders").update(orderPatch).eq("id", order.id);

  await notifyPaymentFailed(emailConfig, emailOrder, { amount: order.total_amount, payment_method: null, payment_id: null, failure_reason: status.failureReason }, user?.email ?? null);

  console.warn(`Payment failed on callback for ${order.order_number}: ${status.failureReason}`);
  return {
    status: "failed",
    message: "Your payment could not be completed. No amount has been charged. You can retry from your order page.",
    redirectTo: `/orders/${order.id}`,
  };
}
