import { NextResponse, type NextRequest } from "next/server";
import { handlePaymentCallback } from "@/lib/payments/callback";
import { setFlash } from "@/lib/flash";

// Ported from Controllers/CheckoutController.cs#PaymentCallback. Where Cashfree's return_url
// sends the customer's browser; verifies with the API before trusting anything (see
// lib/payments/callback.ts's comment) then redirects to the right place with a flash message.
//
// This is a Route Handler, not a page — Next.js only allows cookies() writes (which setFlash()
// does) from a Server Action or Route Handler, never from a plain page's Server Component
// render. The original version of this file was a page.tsx that called setFlash() directly in
// its render body, which crashed every real payment callback with "A server error occurred"
// (masked behind Cashfree's earlier domain-whitelist error until that was fixed and a payment
// actually completed far enough to hit this redirect).
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order_id");
  const result = await handlePaymentCallback(orderId);

  await setFlash(result.status === "success" ? "success" : result.status === "pending" ? "info" : "error", result.message);

  return NextResponse.redirect(new URL(result.redirectTo, request.url));
}
