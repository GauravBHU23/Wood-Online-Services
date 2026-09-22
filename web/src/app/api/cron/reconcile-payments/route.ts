import { reconcilePendingPayments } from "@/lib/payments/reconciliation";

// Ported from Services/PaymentReconciliationService.cs — see that module's comment for why this
// is an API route rather than an in-process background worker in this stack.
//
// Call every 5 minutes from an external scheduler with:
//   Authorization: Bearer <CRON_SECRET>
// e.g. Vercel Cron (vercel.json), or Supabase's pg_cron + pg_net calling this URL, or any other
// scheduler capable of an authenticated HTTP GET/POST.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await reconcilePendingPayments();
    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error("Payment reconciliation pass failed.", err);
    return Response.json({ success: false, message: "Reconciliation failed." }, { status: 500 });
  }
}

export const POST = GET;
