import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Ported from Services/CashfreeService.cs. Covers UPI, cards, net banking and wallets through
// Cashfree's hosted checkout, launched client-side with the payment_session_id this returns.
//
// Config comes from env vars (CASHFREE_*), not the site_settings table's cashfree_* columns —
// those columns exist for a future admin-panel settings UI (Phase 6) to edit and persist, but
// until that UI writes to them the env vars are the actual source of truth, same as the
// original read appsettings.json/Azure App Settings rather than a DB row.

export type PaymentMode = "disabled" | "simulated" | "live";

function getSettings() {
  const mode = (process.env.CASHFREE_MODE as PaymentMode) || "disabled";
  return {
    mode,
    clientId: process.env.CASHFREE_CLIENT_ID ?? "",
    clientSecret: process.env.CASHFREE_CLIENT_SECRET ?? "",
    baseUrl: (process.env.CASHFREE_BASE_URL ?? "https://sandbox.cashfree.com/pg").replace(/\/$/, ""),
    apiVersion: process.env.CASHFREE_API_VERSION ?? "2026-01-01",
    siteBaseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  };
}

export function isSimulated(): boolean {
  return getSettings().mode === "simulated";
}

export function isEnabled(): boolean {
  const s = getSettings();
  return s.mode === "simulated" || (s.mode === "live" && !!s.clientId && !!s.clientSecret);
}

/** Explains why live mode is not usable, or null when it is fine. */
export function liveConfigurationProblem(): string | null {
  const s = getSettings();
  if (s.mode !== "live") return null;

  const missing: string[] = [];
  if (!s.clientId) missing.push("CASHFREE_CLIENT_ID");
  if (!s.clientSecret) missing.push("CASHFREE_CLIENT_SECRET");
  if (missing.length > 0) return `Missing Cashfree ${missing.join(", ")}.`;

  if (!s.siteBaseUrl) return "NEXT_PUBLIC_SITE_URL is not set.";

  if (s.siteBaseUrl.includes("localhost") || s.siteBaseUrl.includes("127.0.0.1")) {
    return "NEXT_PUBLIC_SITE_URL points at localhost, which Cashfree cannot reach. Use Simulated mode locally, or deploy behind a public HTTPS domain.";
  }

  return null;
}

/** True when online payment can actually be taken right now. */
export function isUsable(): boolean {
  return isEnabled() && liveConfigurationProblem() === null;
}

export function getClientId(): string {
  const s = getSettings();
  return s.mode === "live" ? s.clientId : "";
}

export interface PaymentRequestResult {
  success: boolean;
  paymentRequestId: string | null;
  paymentUrl: string | null; // Cashfree's payment_session_id (name kept for schema continuity)
  errorMessage: string | null;
}

interface OrderForPayment {
  orderNumber: string;
  totalAmount: number;
  userId: string;
}

function truncate(value: string | null | undefined, max: number): string {
  if (!value) return "";
  return value.length <= max ? value : value.slice(0, max);
}

function safeCustomerId(userId: string | null | undefined): string {
  if (!userId) return "guest-" + Math.random().toString(36).slice(2, 14);
  const cleaned = userId.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.length > 0 ? truncate(cleaned, 50) : "guest-" + Math.random().toString(36).slice(2, 14);
}

function digitsOnly(input: string): string {
  let digits = input.replace(/\D/g, "");
  // Cashfree wants a bare 10-digit Indian number; strip a leading 91 or 0.
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function createPaymentRequest(
  order: OrderForPayment,
  buyerName: string,
  email: string,
  phone: string
): Promise<PaymentRequestResult> {
  if (!isEnabled()) {
    return { success: false, paymentRequestId: null, paymentUrl: null, errorMessage: "Online payment is not configured." };
  }

  const s = getSettings();

  if (s.mode === "simulated") {
    const requestId = "SIM-" + Math.random().toString(36).slice(2, 18).toUpperCase();
    console.log(`Simulated payment request ${requestId} created for order ${order.orderNumber} (₹${order.totalAmount})`);
    return { success: true, paymentRequestId: requestId, paymentUrl: requestId, errorMessage: null };
  }

  const problem = liveConfigurationProblem();
  if (problem) {
    console.error(`Cannot start payment for ${order.orderNumber}: ${problem}`);
    return {
      success: false,
      paymentRequestId: null,
      paymentUrl: null,
      errorMessage: "Online payment is not available right now. Please choose Cash on Delivery.",
    };
  }

  const siteBase = s.siteBaseUrl.replace(/\/$/, "");
  // Cashfree order ids must be unique per attempt (not per order), because a customer can retry
  // a failed payment and Cashfree rejects a re-used order_id outright.
  const attemptId = `${order.orderNumber}-${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12)}`;

  const payload = {
    order_id: attemptId,
    order_amount: Math.round(order.totalAmount * 100) / 100,
    order_currency: "INR",
    order_note: `Order ${order.orderNumber}`,
    customer_details: {
      customer_id: safeCustomerId(order.userId),
      customer_name: truncate(buyerName, 100),
      customer_email: email,
      customer_phone: digitsOnly(phone),
    },
    order_meta: {
      return_url: `${siteBase}/checkout/payment-callback?order_id={order_id}`,
      notify_url: `${siteBase}/api/payment/webhook`,
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${s.baseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-client-id": s.clientId,
        "x-client-secret": s.clientSecret,
        "x-api-version": s.apiVersion,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = await res.text();

    if (!res.ok) {
      console.error(`Cashfree create-order failed. Body ${truncate(body, 900)}`);
      let message: string | null = null;
      try {
        const json = JSON.parse(body);
        if (typeof json.message === "string") message = json.message;
      } catch {
        // fall through
      }
      return {
        success: false,
        paymentRequestId: null,
        paymentUrl: null,
        errorMessage: message ?? "The payment gateway rejected the request. Please try again.",
      };
    }

    const json = JSON.parse(body);
    const sessionId: string | undefined = json.payment_session_id;
    const cfOrderId: string = json.order_id ?? attemptId;

    if (!sessionId) {
      console.error(`Cashfree order created without a payment_session_id: ${truncate(body, 900)}`);
      return {
        success: false,
        paymentRequestId: null,
        paymentUrl: null,
        errorMessage: "The payment gateway could not create this payment.",
      };
    }

    console.log(`Cashfree order ${cfOrderId} created for order ${order.orderNumber}`);
    return { success: true, paymentRequestId: cfOrderId, paymentUrl: sessionId, errorMessage: null };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`Cashfree create-order timed out for order ${order.orderNumber}`);
      return {
        success: false,
        paymentRequestId: null,
        paymentUrl: null,
        errorMessage: "The payment gateway did not respond in time. Please try again.",
      };
    }
    console.error(`Cashfree create-order threw for order ${order.orderNumber}`, err);
    return {
      success: false,
      paymentRequestId: null,
      paymentUrl: null,
      errorMessage: "We could not reach the payment gateway. Please try again in a moment.",
    };
  }
}

export type TransactionStatus = "created" | "pending" | "success" | "failed" | "refunded";

export interface PaymentStatusResult {
  success: boolean;
  status: TransactionStatus;
  paymentId: string | null;
  paymentMethod: string | null;
  amount: number;
  failureReason: string | null;
  rawResponse: string | null;
}

export async function getPaymentStatus(cashfreeOrderId: string): Promise<PaymentStatusResult> {
  if (!isEnabled()) {
    return { success: false, status: "failed", paymentId: null, paymentMethod: null, amount: 0, failureReason: "Online payment is not configured.", rawResponse: null };
  }

  const s = getSettings();

  if (s.mode === "simulated") {
    // The simulated gateway writes the outcome straight onto the transaction, so the caller
    // already holds the result and there is nothing to fetch.
    return { success: true, status: "pending", paymentId: null, paymentMethod: "Simulated", amount: 0, failureReason: null, rawResponse: "simulated" };
  }

  try {
    const res = await fetch(`${s.baseUrl}/orders/${encodeURIComponent(cashfreeOrderId)}/payments`, {
      headers: {
        Accept: "application/json",
        "x-client-id": s.clientId,
        "x-client-secret": s.clientSecret,
        "x-api-version": s.apiVersion,
      },
    });
    const body = await res.text();

    if (!res.ok) {
      console.error(`Cashfree status check failed for ${cashfreeOrderId}. Status ${res.status}`);
      return { success: false, status: "pending", paymentId: null, paymentMethod: null, amount: 0, failureReason: "Could not verify the payment status.", rawResponse: truncate(body, 3900) };
    }

    const payments = JSON.parse(body);

    if (Array.isArray(payments) && payments.length > 0) {
      for (const payment of payments) {
        if (String(payment.payment_status).toUpperCase() === "SUCCESS") {
          const amount = Number(payment.payment_amount) || 0;
          return {
            success: true,
            status: "success",
            paymentId: payment.cf_payment_id != null ? String(payment.cf_payment_id) : null,
            paymentMethod: payment.payment_group ?? null,
            amount,
            failureReason: null,
            rawResponse: truncate(body, 3900),
          };
        }
      }

      const first = payments[0];
      const firstStatus = String(first.payment_status ?? "").toUpperCase();
      const firstAmount = Number(first.payment_amount) || 0;

      if (firstStatus === "PENDING" || firstStatus === "NOT_ATTEMPTED") {
        return { success: true, status: "pending", paymentId: null, paymentMethod: null, amount: firstAmount, failureReason: null, rawResponse: truncate(body, 3900) };
      }

      return {
        success: true,
        status: "failed",
        paymentId: first.cf_payment_id != null ? String(first.cf_payment_id) : null,
        paymentMethod: first.payment_group ?? null,
        amount: firstAmount,
        failureReason: first.payment_message ?? "Payment was not completed.",
        rawResponse: truncate(body, 3900),
      };
    }

    // No attempts recorded yet: the customer has not reached the bank/UPI step.
    return { success: true, status: "pending", paymentId: null, paymentMethod: null, amount: 0, failureReason: null, rawResponse: truncate(body, 3900) };
  } catch (err) {
    console.error(`Cashfree status check threw for ${cashfreeOrderId}`, err);
    return { success: false, status: "pending", paymentId: null, paymentMethod: null, amount: 0, failureReason: "Could not verify the payment status.", rawResponse: null };
  }
}

/**
 * Cashfree signs webhooks as Base64(HMAC-SHA256(timestamp + rawBody, clientSecret)), delivered
 * via the x-webhook-timestamp and x-webhook-signature headers. The raw, unparsed request body
 * must be used — re-serialising JSON can reorder or re-format it and break the signature.
 */
export function verifyWebhookSignature(rawBody: string, timestamp: string, receivedSignature: string): boolean {
  const s = getSettings();
  if (!s.clientSecret || !timestamp || !receivedSignature) return false;

  try {
    const signedPayload = timestamp + rawBody;
    const computed = createHmac("sha256", s.clientSecret).update(signedPayload, "utf8").digest("base64");

    const a = Buffer.from(computed, "utf8");
    const b = Buffer.from(receivedSignature.trim(), "utf8");
    // Constant-time compare so a caller can't probe the signature byte by byte.
    return a.length === b.length && timingSafeEqual(a, b);
  } catch (err) {
    console.error("Webhook signature verification threw", err);
    return false;
  }
}
