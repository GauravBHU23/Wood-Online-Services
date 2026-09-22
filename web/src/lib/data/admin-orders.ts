import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, OrderStatus, PaymentStatus } from "@/types/database";
import type { OrderWithItems } from "@/lib/data/orders";

// Ported from Areas/Admin/Controllers/OrdersController.cs.

export interface AdminOrderListResult {
  items: OrderWithItems[];
  totalCount: number;
  page: number;
  pageSize: number;
  pendingCount: number;
  confirmedCount: number;
  shippedCount: number;
}

const PAGE_SIZE = 20;

export async function getAdminOrders(filters: { status?: string; search?: string; page?: number }): Promise<AdminOrderListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = admin.from("orders").select("*, items:order_items(*)", { count: "exact" });

  const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  if (filters.status && validStatuses.includes(filters.status)) {
    query = query.eq("order_status", filters.status as OrderStatus);
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`order_number.ilike.%${term}%,shipping_name.ilike.%${term}%,shipping_phone.ilike.%${term}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.order("order_date", { ascending: false }).range(from, to);

  const [result, pendingCount, confirmedCount, shippedCount] = await Promise.all([
    query,
    admin.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "pending").then((r) => r.count ?? 0),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "confirmed").then((r) => r.count ?? 0),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "shipped").then((r) => r.count ?? 0),
  ]);

  return {
    items: (result.data ?? []) as unknown as OrderWithItems[],
    totalCount: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    pendingCount,
    confirmedCount,
    shippedCount,
  };
}

export interface AdminOrderDetail extends OrderWithItems {
  user: { full_name: string; email: string; created_at: string } | null;
}

export async function getAdminOrderById(id: number): Promise<AdminOrderDetail | null> {
  const admin = createAdminClient();
  const result = await admin.from("orders").select("*, items:order_items(*)").eq("id", id).maybeSingle();
  if (!result.data) return null;

  const order = result.data as OrderWithItems;
  const userResult = await admin.auth.admin.getUserById(order.user_id);
  const profileResult = await admin.from("profiles").select("full_name, created_at").eq("id", order.user_id).maybeSingle();
  const profile = profileResult.data as { full_name: string; created_at: string } | null;

  return {
    ...order,
    user: userResult.data.user
      ? { full_name: profile?.full_name ?? "", email: userResult.data.user.email ?? "", created_at: profile?.created_at ?? "" }
      : null,
  };
}

export interface UpdateOrderStatusInput {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  trackingNumber?: string;
}

export async function updateAdminOrderStatus(
  id: number,
  input: UpdateOrderStatusInput
): Promise<{ statusChanged: boolean; order: OrderWithItems; customerEmail: string | null } | null> {
  const admin = createAdminClient();
  const orderResult = await admin.from("orders").select("*, items:order_items(*)").eq("id", id).maybeSingle();
  const order = orderResult.data as OrderWithItems | null;
  if (!order) return null;

  const wasCancelled = order.order_status === "cancelled";
  const statusChanged = order.order_status !== input.orderStatus;

  const patch: Database["public"]["Tables"]["orders"]["Update"] = {
    order_status: input.orderStatus,
    payment_status: input.paymentStatus,
    tracking_number: input.trackingNumber?.trim() || null,
  };

  if (input.orderStatus === "shipped" && !order.shipped_date) {
    patch.shipped_date = new Date().toISOString();
  }

  if (input.orderStatus === "delivered") {
    if (!order.delivered_date) patch.delivered_date = new Date().toISOString();
    // A delivered COD order has been paid for by definition.
    if (order.payment_method === "cod" && input.paymentStatus === "pending") {
      patch.payment_status = "paid";
    }
  }

  await admin.from("orders").update(patch).eq("id", id);

  // Stock moves only on the transition, so repeated saves don't double-count it.
  if (input.orderStatus === "cancelled" && !wasCancelled) {
    for (const item of order.items) {
      const productResult = await admin.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle();
      const product = productResult.data as { stock_quantity: number } | null;
      if (product) {
        const productPatch: Database["public"]["Tables"]["products"]["Update"] = { stock_quantity: product.stock_quantity + item.quantity };
        await admin.from("products").update(productPatch).eq("id", item.product_id);
      }
    }
  } else if (wasCancelled && input.orderStatus !== "cancelled") {
    for (const item of order.items) {
      const productResult = await admin.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle();
      const product = productResult.data as { stock_quantity: number } | null;
      if (product) {
        const productPatch: Database["public"]["Tables"]["products"]["Update"] = {
          stock_quantity: Math.max(0, product.stock_quantity - item.quantity),
        };
        await admin.from("products").update(productPatch).eq("id", item.product_id);
      }
    }
  }

  const userResult = await admin.auth.admin.getUserById(order.user_id);

  const updatedOrder: OrderWithItems = { ...order, order_status: input.orderStatus, payment_status: patch.payment_status as PaymentStatus, tracking_number: patch.tracking_number as string | null };

  return { statusChanged, order: updatedOrder, customerEmail: userResult.data.user?.email ?? null };
}
