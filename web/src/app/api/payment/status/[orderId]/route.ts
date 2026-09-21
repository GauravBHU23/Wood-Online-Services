import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiError } from "@/lib/api-response";

// Ported from Controllers/Api/PaymentApiController.cs#Status. Lets the customer's own order page
// poll while a payment settles. Scoped by user via RLS (orders_select_own_or_admin) — the
// anon/authenticated client here, not the service role, so one customer cannot poll another's order.
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("Unauthorized.", 401);

  const { orderId } = await params;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) return apiError("Order not found.", 404);

  const result = await supabase
    .from("orders")
    .select("order_number, payment_status, order_status, total_amount")
    .eq("id", id)
    .maybeSingle();

  if (!result.data) return apiError("Order not found.", 404);

  const order = result.data;
  return apiSuccess({
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    amount: order.total_amount,
    isPaid: order.payment_status === "paid",
  });
}
