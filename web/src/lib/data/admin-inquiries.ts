import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, InquiryStatus } from "@/types/database";

// Ported from Areas/Admin/Controllers/InquiriesController.cs.

export type Inquiry = Database["public"]["Tables"]["inquiries"]["Row"];
export type InquiryWithProduct = Inquiry & { product: { id: number; name: string } | null };

export interface AdminInquiryListResult {
  items: InquiryWithProduct[];
  totalCount: number;
  page: number;
  pageSize: number;
  newCount: number;
  contactedCount: number;
  closedCount: number;
}

const PAGE_SIZE = 20;

export async function getAdminInquiries(filters: { status?: string; search?: string; page?: number }): Promise<AdminInquiryListResult> {
  const admin = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);

  let query = admin.from("inquiries").select("*, product:products(id, name)", { count: "exact" });

  const validStatuses = ["new", "contacted", "closed"];
  if (filters.status && validStatuses.includes(filters.status)) {
    query = query.eq("status", filters.status as InquiryStatus);
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,message.ilike.%${term}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.order("created_at", { ascending: false }).range(from, to);

  const [result, newCount, contactedCount, closedCount] = await Promise.all([
    query,
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new").then((r) => r.count ?? 0),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "contacted").then((r) => r.count ?? 0),
    admin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "closed").then((r) => r.count ?? 0),
  ]);

  return {
    items: (result.data ?? []) as unknown as InquiryWithProduct[],
    totalCount: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    newCount,
    contactedCount,
    closedCount,
  };
}

export async function getAdminInquiryById(id: number): Promise<InquiryWithProduct | null> {
  const admin = createAdminClient();
  const result = await admin.from("inquiries").select("*, product:products(id, name)").eq("id", id).maybeSingle();
  return (result.data as InquiryWithProduct | null) ?? null;
}

export async function updateInquiryStatus(id: number, status: InquiryStatus, adminNotes?: string): Promise<boolean> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["inquiries"]["Update"] = { status };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes.trim() || null;

  const result = await admin.from("inquiries").update(patch).eq("id", id).select("id").maybeSingle();
  return !!result.data;
}

export async function deleteAdminInquiry(id: number): Promise<boolean> {
  const admin = createAdminClient();
  const result = await admin.from("inquiries").delete().eq("id", id).select("id").maybeSingle();
  return !!result.data;
}
