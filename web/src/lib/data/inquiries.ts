import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteSettingsPublic, toEmailConfig } from "@/lib/data/site-settings";
import { notifyNewInquiry } from "@/lib/email/service";
import type { Database } from "@/types/database";
import type { InquiryInput } from "@/lib/validation/schemas";

// Ported from Controllers/HomeController.cs#Contact (POST).
export async function createInquiry(input: InquiryInput): Promise<void> {
  const admin = createAdminClient();

  const insert: Database["public"]["Tables"]["inquiries"]["Insert"] = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    product_id: input.productId ?? null,
    message: input.message.trim(),
    status: "new",
  };

  const result = await admin.from("inquiries").insert(insert).select("id, created_at").single();
  const inquiry = result.data as { id: number; created_at: string };

  let productName: string | null = null;
  if (input.productId) {
    const productResult = await admin.from("products").select("name").eq("id", input.productId).maybeSingle();
    productName = (productResult.data as { name: string } | null)?.name ?? null;
  }

  const site = await getSiteSettingsPublic();
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await notifyNewInquiry(toEmailConfig(site, siteBaseUrl), {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    productName,
    message: input.message.trim(),
    createdAt: inquiry.created_at,
  });
}
