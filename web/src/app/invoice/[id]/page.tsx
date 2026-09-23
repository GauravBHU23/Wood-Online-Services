import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderById } from "@/lib/data/orders";
import { getSiteSettingsFull } from "@/lib/data/site-settings";
import { buildInvoice } from "@/lib/data/invoice";
import { InvoiceSheet } from "./invoice-sheet";
import { InvoiceActions } from "./invoice-actions";
import "@/styles/invoice.css";

interface PageParams {
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Invoice — Order ${id}` };
}

// Ported from Controllers/OrdersController.cs#Invoice + Views/Orders/Invoice.cshtml +
// Views/Shared/_Invoice.cshtml. Layout = null in the original (a standalone printable page,
// no site header/footer) — matched here by living outside the (site) route group's chrome.
export default async function InvoicePage({ params }: { params: Promise<PageParams> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/account/login?returnUrl=${encodeURIComponent(`/invoice/${id}`)}`);

  const admin = createAdminClient();
  const profileResult = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = (profileResult.data as { role: "customer" | "admin" } | null)?.role === "admin";

  // Admins may view any order's invoice; customers only their own (RLS-equivalent check done
  // here explicitly since this route reads via the service role for the admin case). The order
  // fetch strategy depends on isAdmin, but site settings don't depend on either — fetched in
  // parallel with whichever order query runs.
  const [order, site] = await Promise.all([
    isAdmin
      ? admin
          .from("orders")
          .select("*, items:order_items(*)")
          .eq("id", orderId)
          .maybeSingle()
          .then((r) => r.data as Awaited<ReturnType<typeof getOrderById>>)
      : getOrderById(orderId, user.id),
    getSiteSettingsFull(),
  ]);
  if (!order || !site) notFound();

  const invoice = buildInvoice(order, site);

  const buyerResult = await admin.auth.admin.getUserById(order.user_id);
  const buyerEmail = buyerResult.data.user?.email ?? null;

  return (
    <div style={{ background: "#f4efe6", padding: "20px 12px", minHeight: "100vh" }}>
      <InvoiceActions orderId={order.id} />
      <InvoiceSheet order={order} invoice={invoice} site={site} buyerEmail={buyerEmail} />
    </div>
  );
}
