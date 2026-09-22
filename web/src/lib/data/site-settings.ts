import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { SiteEmailConfig } from "@/lib/email/service";

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

export function toEmailConfig(site: SiteSettingsPublic, siteBaseUrl: string): SiteEmailConfig {
  return {
    shopName: site.shop_name,
    phone: site.phone,
    email: site.email,
    workingHours: site.working_hours,
    siteBaseUrl,
  };
}
