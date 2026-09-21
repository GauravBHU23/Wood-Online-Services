import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type PaymentTransaction = Database["public"]["Tables"]["payment_transactions"]["Row"];

export async function createTransaction(orderId: number, amount: number): Promise<PaymentTransaction> {
  const admin = createAdminClient();
  const insert: Database["public"]["Tables"]["payment_transactions"]["Insert"] = {
    order_id: orderId,
    amount,
    status: "created",
  };
  const result = await admin.from("payment_transactions").insert(insert).select("*").single();
  return result.data as PaymentTransaction;
}

export async function updateTransaction(id: number, patch: Database["public"]["Tables"]["payment_transactions"]["Update"]): Promise<void> {
  const admin = createAdminClient();
  await admin.from("payment_transactions").update(patch).eq("id", id);
}

export async function getTransactionByRequestId(paymentRequestId: string): Promise<PaymentTransaction | null> {
  const admin = createAdminClient();
  const result = await admin.from("payment_transactions").select("*").eq("payment_request_id", paymentRequestId).maybeSingle();
  return (result.data as PaymentTransaction | null) ?? null;
}
