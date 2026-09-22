-- Adds the missing PWA feature flag from Models/AppSettings.cs's FeatureSettings.EnablePwa,
-- which 0001_init_schema.sql omitted from site_settings.

alter table public.site_settings
  add column feature_pwa boolean not null default true;

-- Republish the public projection view so it includes the new column.
drop view if exists public.site_settings_public;

create view public.site_settings_public
  with (security_invoker = true) as
  select
    shop_name, tagline, phone, whatsapp_number, email,
    address_line1, address_line2, working_hours, map_embed_url,
    gst_number, gst_rate, prices_include_gst, state_name, state_code,
    invoice_prefix, shipping_charge, free_shipping_above,
    feature_reviews, feature_moderate_reviews, feature_require_purchase_to_review,
    feature_visitor_counter, feature_geolocation, feature_pwa
  from public.site_settings;

grant select on public.site_settings_public to anon, authenticated;
