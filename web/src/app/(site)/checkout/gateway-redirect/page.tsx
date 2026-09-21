import type { Metadata } from "next";
import { GatewayRedirectClient } from "./gateway-redirect-client";

export const metadata: Metadata = { title: "Redirecting to Payment" };

// Ported from Views/Checkout/GatewayRedirect.cshtml — a thin page that launches Cashfree's
// hosted checkout with the JS SDK (not a plain HTTP redirect).
export default async function GatewayRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; clientId?: string }>;
}) {
  const { sessionId, clientId } = await searchParams;
  return <GatewayRedirectClient sessionId={sessionId ?? ""} clientId={clientId ?? ""} />;
}
