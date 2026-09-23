import type { Metadata } from "next";
import { getSiteSettingsFull } from "@/lib/data/site-settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

// New admin feature — the original had no runtime settings UI (SiteSettings.cs is config-bound
// from appsettings.json, edited by hand on the server). Reads the full row (service-role only,
// via requireAdmin() on the parent layout) rather than site_settings_public, so this page always
// reflects exactly what's stored, not a fallback.
export default async function AdminSettingsPage() {
  const settings = await getSiteSettingsFull();

  return (
    <SettingsForm
      initial={
        settings
          ? {
              shopName: settings.shop_name,
              tagline: settings.tagline,
              phone: settings.phone,
              whatsappNumber: settings.whatsapp_number,
              email: settings.email,
              addressLine1: settings.address_line1,
              addressLine2: settings.address_line2,
              workingHours: settings.working_hours,
              mapEmbedUrl: settings.map_embed_url,
              gstNumber: settings.gst_number,
              gstRate: settings.gst_rate,
              pricesIncludeGst: settings.prices_include_gst,
              stateName: settings.state_name,
              stateCode: settings.state_code,
              panNumber: settings.pan_number,
              bankName: settings.bank_name,
              bankAccountNumber: settings.bank_account_number,
              bankIfsc: settings.bank_ifsc,
              upiId: settings.upi_id,
              invoicePrefix: settings.invoice_prefix,
              shippingCharge: settings.shipping_charge,
              freeShippingAbove: settings.free_shipping_above,
              featureReviews: settings.feature_reviews,
              featureModerateReviews: settings.feature_moderate_reviews,
              featureRequirePurchaseToReview: settings.feature_require_purchase_to_review,
              featureVisitorCounter: settings.feature_visitor_counter,
              featureGeolocation: settings.feature_geolocation,
              featurePwa: settings.feature_pwa,
            }
          : null
      }
    />
  );
}
