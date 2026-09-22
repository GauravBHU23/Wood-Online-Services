"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatusAction } from "@/lib/admin/order-actions";
import { useToast } from "@/components/ui/toast-provider";
import type { OrderStatus, PaymentStatus } from "@/types/database";

const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES: PaymentStatus[] = ["pending", "paid", "failed", "refunded"];

// Ported from the "Update Order" panel in Views/Orders/Details.cshtml.
export function UpdateOrderStatusForm({
  orderId,
  orderStatus,
  paymentStatus,
  trackingNumber,
}: {
  orderId: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ orderStatus, paymentStatus, trackingNumber: trackingNumber ?? "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, form);
      if (result.success) {
        toast.success(result.message ?? "Updated.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update.");
      }
    });
  }

  return (
    <div className="panel mb-3">
      <div className="panel-header">Update Order</div>
      <div className="panel-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Order Status</label>
            <select className="form-select" value={form.orderStatus} onChange={(e) => setForm((f) => ({ ...f, orderStatus: e.target.value as OrderStatus }))}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <div className="small text-muted-wood mt-1">Cancelling automatically returns the stock.</div>
          </div>

          <div className="mb-3">
            <label className="form-label">Payment Status</label>
            <select className="form-select" value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value as PaymentStatus }))}>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Tracking Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="Transport or courier tracking number"
              value={form.trackingNumber}
              onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))}
            />
            <div className="small text-muted-wood mt-1">The customer sees this on their order page.</div>
          </div>

          <button type="submit" className={`btn btn-wood w-100${pending ? " is-busy" : ""}`} disabled={pending}>
            {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
            {pending ? "Updating..." : "Update"}
          </button>
        </form>
      </div>
    </div>
  );
}
