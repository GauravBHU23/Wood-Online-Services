import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import * as cashfree from "@/lib/payments/cashfree";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyOrderPlaced, notifyPaymentSuccess } from "@/lib/email/service";
import type { Database } from "@/types/database";
import type { Order } from "@/lib/data/orders";
import type { PaymentTransaction } from "@/lib/payments/transactions";

// Ported from Services/PaymentReconciliationService.cs — safety net for missed webhooks.
//
// A webhook can be lost for ordinary reasons: the serverless function was cold-starting, the
// network dropped the callback, etc. When that happens the customer has paid but the order
// still says Pending, which is the worst possible state to leave someone in. This walks pending
// transactions and asks Cashfree what actually happened, so the order self-corrects.
//
// The original ran this as an in-process BackgroundService polling every 5 minutes; Next.js
// (especially deployed serverless) has no equivalent long-running process, so this is exposed
// as an API route (api/cron/reconcile-payments) instead, meant to be called every 5 minutes by
// an external scheduler — Vercel Cron, Supabase's pg_cron + pg_net, or any other scheduler
// hitting the URL with the CRON_SECRET bearer token. See that route for the auth check.

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // Anything older was almost certainly abandoned at the gateway.
const BATCH_SIZE = 25;

export interface ReconciliationResult {
  checked: number;
  markedPaid: number;
  markedFailed: number;
  stillPending: number;
  skippedReason?: string;
}

export async function reconcilePendingPayments(): Promise<ReconciliationResult> {
  // Nothing to reconcile when the gateway is off or simulated.
  if (!cashfree.isUsable() || cashfree.isSimulated()) {
    return { checked: 0, markedPaid: 0, markedFailed: 0, stillPending: 0, skippedReason: "Cashfree not usable or simulated." };
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();

  const result = await admin
    .from("payment_transactions")
    .select("*")
    .eq("status", "pending")
    .not("payment_request_id", "is", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  const pending: PaymentTransaction[] = result.data ?? [];
  if (pending.length === 0) {
    return { checked: 0, markedPaid: 0, markedFailed: 0, stillPending: 0 };
  }

  console.log(`Reconciling ${pending.length} pending payment(s).`);

  let markedPaid = 0;
  let markedFailed = 0;
  let stillPending = 0;

  // Batch-fetch every transaction's order in one round trip instead of one query per iteration
  // (a real N+1 with up to BATCH_SIZE queries otherwise) — site settings run alongside it since
  // neither depends on the other.
  const orderIds = [...new Set(pending.map((t) => t.order_id))];
  const [ordersResult, site] = await Promise.all([
    admin.from("orders").select("*").in("id", orderIds),
    getSiteSettingsPublic(),
  ]);
  const ordersById = new Map<number, Order>((ordersResult.data as Order[] | null ?? []).map((o) => [o.id, o]));
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const emailConfig = toEmailConfig(site, siteBaseUrl);

  for (const transaction of pending) {
    const order = ordersById.get(transaction.order_id) ?? null;
    if (!order) continue;

    const status = await cashfree.getPaymentStatus(transaction.payment_request_id!);

    // A failed lookup means we could not reach Cashfree; leave it pending and retry later.
    if (!status.success) {
      stillPending++;
      continue;
    }

    if (status.status === "success") {
      await markPaid(admin, order, transaction, status, emailConfig);
      markedPaid++;
    } else if (status.status === "failed") {
      const txPatch: Database["public"]["Tables"]["payment_transactions"]["Update"] = {
        status: "failed",
        failure_reason: status.failureReason ?? "Payment was not completed.",
        completed_at: new Date().toISOString(),
      };
      await admin.from("payment_transactions").update(txPatch).eq("id", transaction.id);

      const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = { payment_status: "failed" };
      await admin.from("orders").update(orderPatch).eq("id", order.id);

      console.log(`Reconciled ${order.order_number} as failed.`);
      markedFailed++;
    } else {
      // Still Pending at the gateway: the customer has not finished paying yet.
      stillPending++;
    }
  }

  return { checked: pending.length, markedPaid, markedFailed, stillPending };
}

async function markPaid(
  admin: ReturnType<typeof createAdminClient>,
  order: Order,
  transaction: PaymentTransaction,
  status: Awaited<ReturnType<typeof cashfree.getPaymentStatus>>,
  emailConfig: Awaited<ReturnType<typeof toEmailConfig>>
) {
  const txPatch: Database["public"]["Tables"]["payment_transactions"]["Update"] = {
    status: "success",
    payment_id: status.paymentId,
    payment_method: status.paymentMethod,
    completed_at: new Date().toISOString(),
    gateway_response: status.rawResponse,
  };
  await admin.from("payment_transactions").update(txPatch).eq("id", transaction.id);

  const orderPatch: Database["public"]["Tables"]["orders"]["Update"] = {
    payment_status: "paid",
    payment_reference: status.paymentId,
    // Only ever move the order forward.
    ...(order.order_status === "pending" ? { order_status: "confirmed" as const } : {}),
  };
  await admin.from("orders").update(orderPatch).eq("id", order.id);

  const userResult = await admin.auth.admin.getUserById(order.user_id);
  const email = userResult.data.user?.email ?? null;

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

  // The customer never got a confirmation when the webhook was missed, so send it now.
  await notifyOrderPlaced(emailConfig, emailOrder, email);
  await notifyPaymentSuccess(emailConfig, emailOrder, { amount: order.total_amount, payment_method: status.paymentMethod, payment_id: status.paymentId, failure_reason: null }, email);

  console.warn(`Recovered a missed webhook: order ${order.order_number} marked paid by reconciliation.`);
}
