import { createAdminClient } from "@/lib/supabase/admin";
import * as cashfree from "@/lib/payments/cashfree";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyPaymentSuccess, notifyPaymentFailed } from "@/lib/email/service";
import type { Database } from "@/types/database";
import type { Order } from "@/lib/data/orders";

// Ported from Controllers/Api/PaymentApiController.cs#Webhook.
//
// Server-to-server callback from Cashfree. Anonymous by necessity — the gateway has no session —
// so authenticity rests ENTIRELY on the HMAC signature, verified before anything is written.
// Every check below (raw body, timestamp presence, freshness window, signature) exists in the
// original and is preserved exactly; do not simplify this route.

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length <= max ? value : value.slice(0, max);
}

export async function POST(request: Request) {
  // The exact raw bytes are required: the signature is computed over them verbatim, and
  // re-serialising parsed JSON can reorder keys or change formatting and break the check.
  const rawBody = await request.text();

  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  const signature = request.headers.get("x-webhook-signature") ?? "";

  if (!timestamp || !signature) {
    console.warn("Payment webhook rejected: signature headers missing.");
    return Response.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  // A correctly-signed payload is valid forever unless we also check its age, which would let a
  // captured request (e.g. from a compromised log) be replayed at any later time. Cashfree sends
  // the timestamp as Unix epoch milliseconds.
  const epochMs = Number(timestamp);
  if (!Number.isFinite(epochMs) || !/^\d+$/.test(timestamp)) {
    console.warn("Payment webhook rejected: malformed timestamp.");
    return Response.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const sentAt = epochMs;
  const ageMs = Date.now() - sentAt;
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  if (ageMs > FIVE_MINUTES_MS || ageMs < -FIVE_MINUTES_MS) {
    console.warn(`Payment webhook rejected: timestamp outside freshness window (${ageMs}ms).`);
    return Response.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  if (!cashfree.verifyWebhookSignature(rawBody, timestamp, signature)) {
    // Someone posted a forged callback. Log it and give nothing away.
    console.warn("Payment webhook rejected: signature mismatch.");
    return Response.json({ success: false, message: "Invalid request." }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("Payment webhook rejected: malformed JSON.");
    return Response.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const eventType = typeof payload.type === "string" ? payload.type : null;
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return Response.json({ success: true });

  const orderEl = data.order as Record<string, unknown> | undefined;
  const cashfreeOrderId = typeof orderEl?.order_id === "string" ? orderEl.order_id : null;
  if (!cashfreeOrderId) return Response.json({ success: true });

  const admin = createAdminClient();
  const txResult = await admin.from("payment_transactions").select("*").eq("payment_request_id", cashfreeOrderId).maybeSingle();
  const transaction = txResult.data as Database["public"]["Tables"]["payment_transactions"]["Row"] | null;

  if (!transaction) {
    console.warn(`Payment webhook for unknown order ${cashfreeOrderId}`);
    return Response.json({ success: true }); // Acknowledge so Cashfree stops retrying.
  }

  // Cashfree retries webhooks; a settled transaction must not be processed twice.
  if (transaction.status === "success") {
    console.log(`Duplicate webhook ignored for ${cashfreeOrderId}`);
    return Response.json({ success: true });
  }

  const orderResult = await admin.from("orders").select("*").eq("id", transaction.order_id).maybeSingle();
  const order = orderResult.data as Order | null;
  if (!order) {
    console.warn(`Payment webhook for transaction with no order: ${cashfreeOrderId}`);
    return Response.json({ success: true });
  }

  const paymentEl = data.payment as Record<string, unknown> | undefined;
  const paymentId = paymentEl && typeof paymentEl.cf_payment_id !== "undefined" ? String(paymentEl.cf_payment_id) : null;
  const paymentMethod = typeof paymentEl?.payment_group === "string" ? paymentEl.payment_group : null;

  const succeeded = eventType?.toUpperCase() === "PAYMENT_SUCCESS_WEBHOOK";
  const failed = eventType?.toUpperCase() === "PAYMENT_FAILED_WEBHOOK" || eventType?.toUpperCase() === "PAYMENT_USER_DROPPED_WEBHOOK";

  if (!succeeded && !failed) {
    // Other event types (refunds, disputes) are outside this order's payment flow.
    return Response.json({ success: true });
  }

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

  const userResult = await admin.auth.admin.getUserById(order.user_id);
  const email = userResult.data.user?.email ?? null;

  const txPatch: Database["public"]["Tables"]["payment_transactions"]["Update"] = {
    payment_id: paymentId,
    is_webhook_verified: true,
    payment_method: paymentMethod,
    completed_at: new Date().toISOString(),
    gateway_response: truncate(rawBody, 4000),
  };

  if (succeeded) {
    await admin.from("payment_transactions").update({ ...txPatch, status: "success" }).eq("id", transaction.id);

    const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = {
      payment_status: "paid",
      payment_reference: paymentId,
      // Only advance the order; never walk an already-shipped order backwards.
      ...(order.order_status === "pending" ? { order_status: "confirmed" as const } : {}),
    };
    await admin.from("orders").update(orderPatch).eq("id", order.id);

    await notifyPaymentSuccess(emailConfig, emailOrder, { amount: order.total_amount, payment_method: paymentMethod, payment_id: paymentId, failure_reason: null }, email);

    console.log(`Payment confirmed for order ${order.order_number}, payment ${paymentId}`);
  } else {
    const errorDetails = data.error_details as Record<string, unknown> | undefined;
    const errorMessage =
      (typeof errorDetails?.error_description === "string" ? errorDetails.error_description : null) ??
      (typeof paymentEl?.payment_message === "string" ? paymentEl.payment_message : null) ??
      "Payment was not completed.";

    await admin
      .from("payment_transactions")
      .update({ ...txPatch, status: "failed", failure_reason: truncate(errorMessage, 500) })
      .eq("id", transaction.id);

    const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = { payment_status: "failed" };
    await admin.from("orders").update(orderPatch).eq("id", order.id);

    await notifyPaymentFailed(emailConfig, emailOrder, { amount: order.total_amount, payment_method: null, payment_id: null, failure_reason: errorMessage }, email);

    console.warn(`Payment failed for order ${order.order_number}: ${errorMessage}`);
  }

  return Response.json({ success: true });
}
