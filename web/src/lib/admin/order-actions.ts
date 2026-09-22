"use server";

import { revalidatePath } from "next/cache";
import { updateAdminOrderStatus, type UpdateOrderStatusInput } from "@/lib/data/admin-orders";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyOrderStatus } from "@/lib/email/service";
import type { ActionResult } from "@/lib/auth/types";
import type { OrderStatusForEmail } from "@/lib/email/templates";

// Ported from Areas/Admin/Controllers/OrdersController.cs#UpdateStatus.
export async function updateOrderStatusAction(id: number, input: UpdateOrderStatusInput): Promise<ActionResult> {
  const result = await updateAdminOrderStatus(id, input);
  if (!result) return { success: false, message: "Order not found." };

  if (result.statusChanged) {
    const site = await getSiteSettingsPublic();
    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await notifyOrderStatus(
      toEmailConfig(site, siteBaseUrl),
      {
        id: result.order.id,
        order_number: result.order.order_number,
        payment_method: result.order.payment_method,
        notes: result.order.notes,
        shipping_name: result.order.shipping_name,
        shipping_address: result.order.shipping_address,
        shipping_city: result.order.shipping_city,
        shipping_state: result.order.shipping_state,
        shipping_pin_code: result.order.shipping_pin_code,
        shipping_phone: result.order.shipping_phone,
        sub_total: result.order.sub_total,
        shipping_charge: result.order.shipping_charge,
        total_amount: result.order.total_amount,
        items: result.order.items,
      },
      result.order.order_status as OrderStatusForEmail,
      result.order.tracking_number,
      result.customerEmail
    );
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath(`/orders/${id}`);
  revalidatePath("/orders");

  return { success: true, message: `Order ${result.order.order_number} has been updated.` };
}
