import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTransactionByRequestId } from "@/lib/payments/transactions";
import * as cashfree from "@/lib/payments/cashfree";
import { SimulatedGatewayForm } from "./simulated-gateway-form";

export const metadata: Metadata = { title: "Complete Payment" };

// Ported from Controllers/CheckoutController.cs#SimulatedGateway (GET) + Views/Checkout/SimulatedGateway.cshtml.
export default async function SimulatedGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  if (!cashfree.isSimulated()) notFound();

  const { requestId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/account/login");

  if (!requestId) redirect("/orders");

  const transaction = await getTransactionByRequestId(requestId);
  if (!transaction) redirect("/orders");

  const admin = createAdminClient();
  const orderResult = await admin.from("orders").select("id, order_number, user_id").eq("id", transaction.order_id).maybeSingle();
  const order = orderResult.data as { id: number; order_number: string; user_id: string } | null;

  // Scoped to the signed-in customer so nobody can drive someone else's payment.
  if (!order || order.user_id !== user.id) redirect("/orders");

  if (transaction.status === "success") redirect(`/checkout/success?orderNumber=${order.order_number}`);

  return <SimulatedGatewayForm requestId={requestId} amount={transaction.amount} orderNumber={order.order_number} />;
}
