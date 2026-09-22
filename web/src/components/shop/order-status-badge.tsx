import type { OrderStatus } from "@/lib/data/orders";

// Ported from Views/Shared/_OrderStatusBadge.cshtml.
const STYLES: Record<OrderStatus, { css: string; label: string }> = {
  pending: { css: "bg-warning text-dark", label: "Pending" },
  confirmed: { css: "bg-info text-dark", label: "Confirmed" },
  shipped: { css: "bg-primary", label: "Shipped" },
  delivered: { css: "bg-success", label: "Delivered" },
  cancelled: { css: "bg-danger", label: "Cancelled" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { css, label } = STYLES[status] ?? { css: "bg-secondary", label: status };
  return <span className={`badge ${css}`}>{label}</span>;
}
