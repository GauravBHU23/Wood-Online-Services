import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { SiteEmailConfig } from "@/lib/email/service";
import type { SiteSettingsGeneralInput, SiteSettingsPaymentInput } from "@/lib/validation/schemas";

export type SiteSettingsPublic = Database["public"]["Views"]["site_settings_public"]["Row"];
export type SiteSettingsFull = Database["public"]["Tables"]["site_settings"]["Row"];

const FALLBACK_PUBLIC: SiteSettingsPublic = {
  shop_name: "Wood Online Service",
  tagline: "Handcrafted Wooden Furniture",
  phone: "+91 00000 00000",
  whatsapp_number: "910000000000",
  email: "info@example.com",
  address_line1: "Shop Address Line 1",
  address_line2: "City, State - PIN",
  working_hours: "Mon - Sat, 10:00 AM - 8:00 PM",
  map_embed_url: "",
  gst_number: "",
  gst_rate: 0,
  prices_include_gst: true,
  state_name: "Bihar",
  state_code: "10",
  invoice_prefix: "INV",
  shipping_charge: 500,
  free_shipping_above: 20000,
  feature_reviews: true,
  feature_moderate_reviews: true,
  feature_require_purchase_to_review: false,
  feature_visitor_counter: true,
  feature_geolocation: true,
  feature_pwa: true,
};

/** Public, non-secret shop settings — safe to call from any Server Component (anon-readable view). */
export async function getSiteSettingsPublic(): Promise<SiteSettingsPublic> {
  const supabase = await createClient();
  const result = await supabase.from("site_settings_public").select("*").single();
  return (result.data as SiteSettingsPublic | null) ?? FALLBACK_PUBLIC;
}

/** Full row including Cashfree/Gemini secrets — service-role only, server-side callers only. */
export async function getSiteSettingsFull(): Promise<SiteSettingsFull | null> {
  const admin = createAdminClient();
  const result = await admin.from("site_settings").select("*").single();
  return result.data as SiteSettingsFull | null;
}

/**
 * Updates the shop's non-secret display/business settings — shop info, GST, shipping, feature
 * flags. Editable from /admin/settings so an admin never needs to touch the database directly.
 * There's exactly one row in site_settings (seeded in migration 0001) — this always targets it,
 * same as getSiteSettingsFull() always reads it with .single().
 */
export async function updateSiteSettingsGeneral(form: SiteSettingsGeneralInput): Promise<void> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["site_settings"]["Update"] = {
    shop_name: form.shopName.trim(),
    tagline: form.tagline?.trim() || "",
    phone: form.phone.trim(),
    whatsapp_number: form.whatsappNumber.trim(),
    email: form.email.trim(),
    address_line1: form.addressLine1.trim(),
    address_line2: form.addressLine2?.trim() || "",
    working_hours: form.workingHours?.trim() || "",
    map_embed_url: form.mapEmbedUrl?.trim() || "",
    gst_number: form.gstNumber?.trim() || "",
    gst_rate: form.gstRate,
    prices_include_gst: form.pricesIncludeGst ?? true,
    state_name: form.stateName.trim(),
    state_code: form.stateCode.trim(),
    pan_number: form.panNumber?.trim() || "",
    bank_name: form.bankName?.trim() || "",
    bank_account_number: form.bankAccountNumber?.trim() || "",
    bank_ifsc: form.bankIfsc?.trim() || "",
    upi_id: form.upiId?.trim() || "",
    invoice_prefix: form.invoicePrefix?.trim() || "INV",
    shipping_charge: form.shippingCharge,
    free_shipping_above: form.freeShippingAbove,
    feature_reviews: form.featureReviews ?? true,
    feature_moderate_reviews: form.featureModerateReviews ?? true,
    feature_require_purchase_to_review: form.featureRequirePurchaseToReview ?? false,
    feature_visitor_counter: form.featureVisitorCounter ?? true,
    feature_geolocation: form.featureGeolocation ?? true,
    feature_pwa: form.featurePwa ?? true,
  };

  const existing = await admin.from("site_settings").select("id").limit(1).maybeSingle();
  if (existing.data) {
    await admin.from("site_settings").update(patch).eq("id", (existing.data as { id: number }).id);
  } else {
    // Defensive only — migration 0001 always seeds exactly one row, this should never run.
    await admin.from("site_settings").insert(patch as Database["public"]["Tables"]["site_settings"]["Insert"]);
  }
}

/**
 * Updates Cashfree/Gemini configuration. An empty string field means "leave it unchanged" (never
 * "clear it") — these are secrets that are never echoed back to the browser, so the form can't
 * distinguish "admin wants this blank" from "admin didn't touch this field"; treating blank as
 * "keep existing" is the safe default that can never accidentally wipe a live credential.
 */
export async function updateSiteSettingsPayment(form: SiteSettingsPaymentInput): Promise<void> {
  const admin = createAdminClient();
  const patch: Database["public"]["Tables"]["site_settings"]["Update"] = {
    cashfree_mode: form.cashfreeMode,
  };
  if (form.cashfreeClientId?.trim()) patch.cashfree_client_id = form.cashfreeClientId.trim();
  if (form.cashfreeClientSecret?.trim()) patch.cashfree_client_secret = form.cashfreeClientSecret.trim();
  if (form.cashfreeBaseUrl?.trim()) patch.cashfree_base_url = form.cashfreeBaseUrl.trim();
  if (form.cashfreeApiVersion?.trim()) patch.cashfree_api_version = form.cashfreeApiVersion.trim();
  patch.gemini_enabled = form.geminiEnabled ?? false;
  if (form.geminiApiKey?.trim()) patch.gemini_api_key = form.geminiApiKey.trim();
  if (form.geminiModel?.trim()) patch.gemini_model = form.geminiModel.trim();

  const existing = await admin.from("site_settings").select("id").limit(1).maybeSingle();
  if (existing.data) {
    await admin.from("site_settings").update(patch).eq("id", (existing.data as { id: number }).id);
  }
}

export function toEmailConfig(site: SiteSettingsPublic, siteBaseUrl: string): SiteEmailConfig {
  return {
    shopName: site.shop_name,
    phone: site.phone,
    email: site.email,
    workingHours: site.working_hours,
    siteBaseUrl,
  };
}
