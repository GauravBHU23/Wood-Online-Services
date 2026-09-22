"use server";

import { revalidatePath } from "next/cache";
import { blockUser, unblockUser } from "@/lib/data/admin-users";
import type { ActionResult } from "@/lib/auth/types";

// Ported from Areas/Admin/Controllers/UsersController.cs#Block/#Unblock.
export async function blockUserAction(id: string): Promise<ActionResult> {
  const result = await blockUser(id);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return result;
}

export async function unblockUserAction(id: string): Promise<ActionResult> {
  const result = await unblockUser(id);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return result;
}
