"use server";

import { revalidatePath } from "next/cache";
import { updateInquiryStatus, deleteAdminInquiry } from "@/lib/data/admin-inquiries";
import type { ActionResult } from "@/lib/auth/types";
import type { InquiryStatus } from "@/types/database";

// Ported from Areas/Admin/Controllers/InquiriesController.cs.
export async function updateInquiryStatusAction(id: number, status: InquiryStatus, adminNotes?: string): Promise<ActionResult> {
  const ok = await updateInquiryStatus(id, status, adminNotes);
  if (!ok) return { success: false, message: "Inquiry not found." };

  revalidatePath("/admin/inquiries");
  revalidatePath(`/admin/inquiries/${id}`);
  return { success: true, message: `Inquiry #${id} status set to "${status}".` };
}

export async function deleteInquiryAction(id: number): Promise<ActionResult> {
  const ok = await deleteAdminInquiry(id);
  if (!ok) return { success: false, message: "Inquiry not found." };

  revalidatePath("/admin/inquiries");
  return { success: true, message: `Inquiry #${id} has been deleted.` };
}
