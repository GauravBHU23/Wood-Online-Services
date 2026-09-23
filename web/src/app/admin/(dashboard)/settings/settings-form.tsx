"use client";

import { useState, useTransition } from "react";
import { updateSiteSettingsAction } from "@/lib/admin/settings-actions";
import { siteSettingsGeneralSchema, type SiteSettingsGeneralInput } from "@/lib/validation/schemas";
import { useToast } from "@/components/ui/toast-provider";
import { Field, inputClass } from "@/components/forms/field";

const FALLBACK: SiteSettingsGeneralInput = {
  shopName: "Wood Online Service",
  tagline: "Handcrafted Wooden Furniture",
  phone: "+91 00000 00000",
  whatsappNumber: "910000000000",
  email: "info@example.com",
  addressLine1: "Shop Address Line 1",
  addressLine2: "City, State - PIN",
  workingHours: "Mon - Sat, 10:00 AM - 8:00 PM",
  mapEmbedUrl: "",
  gstNumber: "",
  gstRate: 0,
  pricesIncludeGst: true,
  stateName: "Bihar",
  stateCode: "10",
  panNumber: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfsc: "",
  upiId: "",
  invoicePrefix: "INV",
  shippingCharge: 500,
  freeShippingAbove: 20000,
  featureReviews: true,
  featureModerateReviews: true,
  featureRequirePurchaseToReview: false,
  featureVisitorCounter: true,
  featureGeolocation: true,
  featurePwa: true,
};

// New admin feature (see page.tsx's comment — the original never had this). Everything here maps
// 1:1 to a column in site_settings and is read back by getSiteSettingsPublic()/
// getSiteSettingsFull() everywhere else in the app (header/footer, invoice GST math, cart
// shipping calc, feature flags), so a save here reaches the storefront immediately.
export function SettingsForm({ initial }: { initial: SiteSettingsGeneralInput | null }) {
  const toast = useToast();
  const [form, setForm] = useState<SiteSettingsGeneralInput>(initial ?? FALLBACK);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = siteSettingsGeneralSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }

    startTransition(async () => {
      const result = await updateSiteSettingsAction(parsed.data);
      if (result.success) {
        toast.success(result.message ?? "Settings have been saved.");
      } else {
        setFormError(result.message ?? "Could not save settings.");
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  function set<K extends keyof SiteSettingsGeneralInput>(key: K, value: SiteSettingsGeneralInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="mb-1">Settings</h1>
          <p className="text-muted-wood mb-0">Shop details shown across the site — changes appear on the storefront as soon as you save.</p>
        </div>
      </div>

      {!initial && (
        <div className="alert alert-warning py-2 small">
          Could not load the current settings — showing defaults. Saving will still work.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="panel mb-3">
              <div className="panel-header">Shop Info</div>
              <div className="panel-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Shop Name" htmlFor="shopName" required error={errors.shopName?.[0]}>
                      <input id="shopName" className={inputClass} value={form.shopName} onChange={(e) => set("shopName", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.[0]}>
                      <input id="tagline" className={inputClass} value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Phone" htmlFor="phone" required error={errors.phone?.[0]}>
                      <input id="phone" className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="WhatsApp Number" htmlFor="whatsappNumber" required error={errors.whatsappNumber?.[0]}>
                      <input
                        id="whatsappNumber"
                        className={inputClass}
                        placeholder="91XXXXXXXXXX"
                        value={form.whatsappNumber}
                        onChange={(e) => set("whatsappNumber", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Email" htmlFor="email" required error={errors.email?.[0]}>
                      <input id="email" type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Working Hours" htmlFor="workingHours" error={errors.workingHours?.[0]}>
                      <input
                        id="workingHours"
                        className={inputClass}
                        value={form.workingHours ?? ""}
                        onChange={(e) => set("workingHours", e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel mb-3">
              <div className="panel-header">Address & Map</div>
              <div className="panel-body">
                <Field label="Address Line 1" htmlFor="addressLine1" required error={errors.addressLine1?.[0]}>
                  <input id="addressLine1" className={inputClass} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
                </Field>
                <Field label="Address Line 2" htmlFor="addressLine2" error={errors.addressLine2?.[0]}>
                  <input id="addressLine2" className={inputClass} value={form.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} />
                </Field>
                <Field label="Google Maps Embed URL" htmlFor="mapEmbedUrl" error={errors.mapEmbedUrl?.[0]}>
                  <input
                    id="mapEmbedUrl"
                    className={inputClass}
                    placeholder="https://www.google.com/maps/embed?..."
                    value={form.mapEmbedUrl ?? ""}
                    onChange={(e) => set("mapEmbedUrl", e.target.value)}
                  />
                  <span className="small text-muted-wood">The embed src URL from Google Maps&apos; Share → Embed a map.</span>
                </Field>
              </div>
            </div>

            <div className="panel mb-3">
              <div className="panel-header">GST & Invoice</div>
              <div className="panel-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <Field label="GST Number (GSTIN)" htmlFor="gstNumber" error={errors.gstNumber?.[0]}>
                      <input id="gstNumber" className={inputClass} value={form.gstNumber ?? ""} onChange={(e) => set("gstNumber", e.target.value)} />
                      <span className="small text-muted-wood">Leave empty if not yet GST registered — tax lines are omitted from invoices.</span>
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="GST Rate (%)" htmlFor="gstRate" error={errors.gstRate?.[0]}>
                      <input
                        id="gstRate"
                        type="number"
                        step={0.01}
                        min={0}
                        max={100}
                        className={inputClass}
                        value={form.gstRate}
                        onChange={(e) => set("gstRate", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="Invoice Prefix" htmlFor="invoicePrefix" error={errors.invoicePrefix?.[0]}>
                      <input
                        id="invoicePrefix"
                        className={inputClass}
                        placeholder="INV"
                        value={form.invoicePrefix ?? ""}
                        onChange={(e) => set("invoicePrefix", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="State" htmlFor="stateName" required error={errors.stateName?.[0]}>
                      <input id="stateName" className={inputClass} value={form.stateName} onChange={(e) => set("stateName", e.target.value)} />
                      <span className="small text-muted-wood">A buyer in this state pays CGST+SGST, otherwise IGST.</span>
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="State Code" htmlFor="stateCode" required error={errors.stateCode?.[0]}>
                      <input id="stateCode" className={inputClass} value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <div className="form-check mb-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="pricesIncludeGst"
                        checked={form.pricesIncludeGst ?? true}
                        onChange={(e) => set("pricesIncludeGst", e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="pricesIncludeGst">
                        Prices include GST
                      </label>
                    </div>
                  </div>
                </div>

                <hr />

                <div className="row g-3">
                  <div className="col-md-4">
                    <Field label="PAN Number" htmlFor="panNumber" error={errors.panNumber?.[0]}>
                      <input id="panNumber" className={inputClass} value={form.panNumber ?? ""} onChange={(e) => set("panNumber", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="Bank Name" htmlFor="bankName" error={errors.bankName?.[0]}>
                      <input id="bankName" className={inputClass} value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-4">
                    <Field label="UPI ID" htmlFor="upiId" error={errors.upiId?.[0]}>
                      <input id="upiId" className={inputClass} value={form.upiId ?? ""} onChange={(e) => set("upiId", e.target.value)} />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Bank Account Number" htmlFor="bankAccountNumber" error={errors.bankAccountNumber?.[0]}>
                      <input
                        id="bankAccountNumber"
                        className={inputClass}
                        value={form.bankAccountNumber ?? ""}
                        onChange={(e) => set("bankAccountNumber", e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Bank IFSC" htmlFor="bankIfsc" error={errors.bankIfsc?.[0]}>
                      <input id="bankIfsc" className={inputClass} value={form.bankIfsc ?? ""} onChange={(e) => set("bankIfsc", e.target.value)} />
                    </Field>
                  </div>
                </div>
                <span className="small text-muted-wood">Bank details are for reference only — printed on invoices if filled in.</span>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">Shipping</div>
              <div className="panel-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <Field label="Shipping Charge (₹)" htmlFor="shippingCharge" error={errors.shippingCharge?.[0]}>
                      <input
                        id="shippingCharge"
                        type="number"
                        step={1}
                        min={0}
                        className={inputClass}
                        value={form.shippingCharge}
                        onChange={(e) => set("shippingCharge", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                  <div className="col-md-6">
                    <Field label="Free Shipping Above (₹)" htmlFor="freeShippingAbove" error={errors.freeShippingAbove?.[0]}>
                      <input
                        id="freeShippingAbove"
                        type="number"
                        step={1}
                        min={0}
                        className={inputClass}
                        value={form.freeShippingAbove}
                        onChange={(e) => set("freeShippingAbove", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="panel mb-3">
              <div className="panel-header">Features</div>
              <div className="panel-body">
                {(
                  [
                    ["featureReviews", "Product reviews"],
                    ["featureModerateReviews", "Moderate reviews before showing"],
                    ["featureRequirePurchaseToReview", "Require a purchase to review"],
                    ["featureVisitorCounter", "Footer visitor counter"],
                    ["featureGeolocation", "Visitor geolocation"],
                    ["featurePwa", "Installable app (PWA)"],
                  ] as const
                ).map(([key, label]) => (
                  <div className="form-check mb-2" key={key}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={key}
                      checked={form[key] ?? true}
                      onChange={(e) => set(key, e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor={key}>
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-body d-grid gap-2">
                <button type="submit" className={`btn btn-wood btn-lg${pending ? " is-busy" : ""}`} disabled={pending}>
                  {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
                  {pending ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
