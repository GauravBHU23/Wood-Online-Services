-- Fixes a real bug: site_settings_public was created `with (security_invoker = true)`, which
-- means it runs with the CALLER's own row-level permissions on the underlying site_settings
-- table, not the view owner's. site_settings has no anon/authenticated RLS policy at all (only
-- site_settings_admin_all, gated by is_admin()) — by design, since the base table holds the
-- Cashfree/Gemini secret columns. The consequence: every anon/authenticated query against this
-- view silently matched zero rows (no error — RLS just filters rows out), so
-- getSiteSettingsPublic() always fell through to its hardcoded FALLBACK_PUBLIC constant in
-- lib/data/site-settings.ts. Every customer-facing page has been showing the placeholder shop
-- name/phone/address/GST rate/shipping charge/etc. since launch, never the real values an admin
-- sets in Settings — admin-panel changes to site_settings never actually reached the storefront.
--
-- The fix: drop `security_invoker`, so the view runs with its OWNER's privileges (the standard
-- Postgres pattern for a "safe projection" view over a sensitive table) — RLS is enforced on the
-- table only when THAT table is queried directly, not when queried through a view that already
-- projects away the sensitive columns and is separately grant-select-restricted to anon/
-- authenticated (already done in 0002). This is safe specifically because the view's column list
-- excludes every secret (cashfree_client_id/secret, gemini_api_key, etc.) — a definer-rights view
-- over a table that DID need row-level filtering would be the wrong fix; this one doesn't.

drop view if exists public.site_settings_public;

create view public.site_settings_public as
  select
    shop_name, tagline, phone, whatsapp_number, email,
    address_line1, address_line2, working_hours, map_embed_url,
    gst_number, gst_rate, prices_include_gst, state_name, state_code,
    invoice_prefix, shipping_charge, free_shipping_above,
    feature_reviews, feature_moderate_reviews, feature_require_purchase_to_review,
    feature_visitor_counter, feature_geolocation, feature_pwa
  from public.site_settings;

grant select on public.site_settings_public to anon, authenticated;
