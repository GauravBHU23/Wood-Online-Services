import { redirect } from "next/navigation";
import { handlePaymentCallback } from "@/lib/payments/callback";
import { setFlash } from "@/lib/flash";

// Ported from Controllers/CheckoutController.cs#PaymentCallback. Where Cashfree's return_url
// sends the customer's browser; verifies with the API before trusting anything (see that
// module's comment) then redirects to the right place with a flash message.
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id } = await searchParams;
  const result = await handlePaymentCallback(order_id ?? null);

  await setFlash(result.status === "success" ? "success" : result.status === "pending" ? "info" : "error", result.message);

  redirect(result.redirectTo);
}
