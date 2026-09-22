"use server";

import { createClient } from "@/lib/supabase/server";
import { cancelOrder } from "@/lib/data/orders";

// Ported from Controllers/OrdersController.cs#Cancel.
export async function cancelOrderAction(orderId: number): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Please sign in again." };

  return cancelOrder(orderId, user.id);
}
