import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order, OrderItem } from "@/lib/data/orders";
import type { Database } from "@/types/database";

// Ported from Areas/Admin/Controllers/DashboardController.cs#Index.

export interface DashboardData {
  totalProducts: number;
  outOfStockCount: number;
  totalCategories: number;
  newInquiries: number;
  totalInquiries: number;
  pendingOrders: number;
  totalOrders: number;
  totalRevenue: number;
  revenueLast30Days: number;
  totalCustomers: number;
  recentOrders: (Order & { items: Pick<OrderItem, "quantity">[] })[];
  recentInquiries: (Database["public"]["Tables"]["inquiries"]["Row"] & { product: { id: number; name: string } | null })[];
  lowStockProducts: (Database["public"]["Tables"]["products"]["Row"] & { category: { id: number; name: string } | null })[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalProducts,
    outOfStockCount,
    totalCategories,
    newInquiries,
    totalInquiries,
    pendingOrders,
    totalOrders,
    revenueRows,
    totalCustomers,
    recentOrdersResult,
    recentInquiriesResult,
    lowStockResult,
  ] = await Promise.all([
    admin.from("products").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    admin.from("products").select("id", { count: "exact", head: true }).eq("is_custom_order", false).lte("stock_quantity", 0).then((r) => r.count ?? 0),
    admin.from("categories").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new").then((r) => r.count ?? 0),
    admin.from("inquiries").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("order_status", "pending").then((r) => r.count ?? 0),
    admin.from("orders").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    admin.from("orders").select("order_date, total_amount").neq("order_status", "cancelled"),
    admin.from("profiles").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
    admin.from("orders").select("*, items:order_items(quantity)").order("order_date", { ascending: false }).limit(8),
    admin.from("inquiries").select("*, product:products(id, name)").order("created_at", { ascending: false }).limit(8),
    admin
      .from("products")
      .select("*, category:categories(id, name)")
      .eq("is_custom_order", false)
      .lte("stock_quantity", 3)
      .order("stock_quantity")
      .limit(8),
  ]);

  const revenue: { order_date: string; total_amount: number }[] = revenueRows.data ?? [];
  const totalRevenue = revenue.reduce((sum, r) => sum + r.total_amount, 0);
  const revenueLast30Days = revenue.filter((r) => r.order_date >= thirtyDaysAgo).reduce((sum, r) => sum + r.total_amount, 0);

  return {
    totalProducts,
    outOfStockCount,
    totalCategories,
    newInquiries,
    totalInquiries,
    pendingOrders,
    totalOrders,
    totalRevenue,
    revenueLast30Days,
    totalCustomers,
    recentOrders: (recentOrdersResult.data ?? []) as unknown as (Order & { items: Pick<OrderItem, "quantity">[] })[],
    recentInquiries: (recentInquiriesResult.data ?? []) as unknown as DashboardData["recentInquiries"],
    lowStockProducts: (lowStockResult.data ?? []) as unknown as DashboardData["lowStockProducts"],
  };
}
