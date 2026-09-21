-- ============================================================================
-- Row Level Security policies
--
-- Mirrors the authorisation rules from the .NET app:
--   - Public catalogue data (categories, products, images, approved reviews) is world-readable.
--   - A customer can only ever read/write their OWN cart, orders, reviews, feedback, inquiries.
--   - Admin role bypasses per-row scoping entirely (role check via profiles.role, see is_admin()).
--   - Payment transactions and site_settings' secret columns (Cashfree/Gemini keys) are never
--     exposed to anon/authenticated — only the service_role key (used from server-side API
--     routes / webhook handler) can touch them.
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.inquiries           enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.cart_items          enable row level security;
alter table public.reviews             enable row level security;
alter table public.review_votes        enable row level security;
alter table public.site_feedback       enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.admin_login_otps    enable row level security;
alter table public.visitor_logs        enable row level security;
alter table public.visitor_counter     enable row level security;
alter table public.site_settings       enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: is the current JWT an admin? SECURITY DEFINER + STABLE so it can be
-- used inside policies without infinite recursion on profiles itself.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- categories — public read of active categories; admin full control
-- ---------------------------------------------------------------------------
create policy "categories_public_read" on public.categories
  for select using (is_active = true or public.is_admin());

create policy "categories_admin_write" on public.categories
  for insert with check (public.is_admin());
create policy "categories_admin_update" on public.categories
  for update using (public.is_admin()) with check (public.is_admin());
create policy "categories_admin_delete" on public.categories
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- products — public read; admin full control
-- ---------------------------------------------------------------------------
create policy "products_public_read" on public.products
  for select using (true);

create policy "products_admin_write" on public.products
  for insert with check (public.is_admin());
create policy "products_admin_update" on public.products
  for update using (public.is_admin()) with check (public.is_admin());
create policy "products_admin_delete" on public.products
  for delete using (public.is_admin());

create policy "product_images_public_read" on public.product_images
  for select using (true);
create policy "product_images_admin_write" on public.product_images
  for insert with check (public.is_admin());
create policy "product_images_admin_update" on public.product_images
  for update using (public.is_admin()) with check (public.is_admin());
create policy "product_images_admin_delete" on public.product_images
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- inquiries — anyone (incl. anon) may create; only admin may read/update/delete
-- ---------------------------------------------------------------------------
create policy "inquiries_public_insert" on public.inquiries
  for insert with check (true);
create policy "inquiries_admin_read" on public.inquiries
  for select using (public.is_admin());
create policy "inquiries_admin_update" on public.inquiries
  for update using (public.is_admin()) with check (public.is_admin());
create policy "inquiries_admin_delete" on public.inquiries
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- orders / order_items — a customer sees only their own; admin sees all
-- Orders are created server-side (service role) via the checkout API route, not
-- directly by the client, so there is no customer insert policy here.
-- ---------------------------------------------------------------------------
create policy "orders_select_own_or_admin" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

create policy "orders_admin_update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create policy "order_items_select_own_or_admin" on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- cart_items — scoped by cart_key, which encodes 'user:<uuid>' or 'guest:<uuid>'.
-- Signed-in customers may only touch rows keyed to their own user id; the guest
-- ('guest:...') path is handled entirely through the server API using the service
-- role, since an anonymous key has no stable identity to check against a policy.
-- ---------------------------------------------------------------------------
create policy "cart_items_owner_all" on public.cart_items
  for all
  using (auth.uid() is not null and cart_key = 'user:' || auth.uid()::text)
  with check (auth.uid() is not null and cart_key = 'user:' || auth.uid()::text);

-- ---------------------------------------------------------------------------
-- reviews — approved reviews are public; a customer sees/edits their own of any
-- status; admin sees/moderates all.
-- ---------------------------------------------------------------------------
create policy "reviews_public_read_approved" on public.reviews
  for select using (status = 'approved' or auth.uid() = user_id or public.is_admin());

create policy "reviews_owner_insert" on public.reviews
  for insert with check (auth.uid() = user_id);

create policy "reviews_owner_update_or_admin" on public.reviews
  for update using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "reviews_owner_delete_or_admin" on public.reviews
  for delete using (auth.uid() = user_id or public.is_admin());

create policy "review_votes_owner_read" on public.review_votes
  for select using (auth.uid() = user_id or public.is_admin());
create policy "review_votes_owner_insert" on public.review_votes
  for insert with check (auth.uid() = user_id);
create policy "review_votes_owner_delete" on public.review_votes
  for delete using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- site_feedback — owner + admin only (no public read; shown via curated admin picks if needed)
-- ---------------------------------------------------------------------------
create policy "site_feedback_owner_read" on public.site_feedback
  for select using (auth.uid() = user_id or public.is_admin());
create policy "site_feedback_owner_insert" on public.site_feedback
  for insert with check (auth.uid() = user_id);
create policy "site_feedback_admin_update" on public.site_feedback
  for update using (public.is_admin()) with check (public.is_admin());
create policy "site_feedback_admin_delete" on public.site_feedback
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- payment_transactions — server-side only (webhook + payment API routes use the
-- service role key, which bypasses RLS). Customers never query this table directly;
-- payment status is surfaced to them through the orders table instead.
-- ---------------------------------------------------------------------------
create policy "payment_transactions_admin_read" on public.payment_transactions
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- admin_login_otps — service role only; no anon/authenticated policy at all,
-- so every access from the client goes through 0 matching policies (= denied).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- visitor_logs / visitor_counter — counter is public read (footer widget);
-- individual logs are admin-only. Writes happen via service role from the API route.
-- ---------------------------------------------------------------------------
create policy "visitor_counter_public_read" on public.visitor_counter
  for select using (true);

create policy "visitor_logs_admin_read" on public.visitor_logs
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- site_settings — public, non-secret display columns only, via a view (below).
-- The base table itself holds Cashfree/Gemini secrets, so it gets NO public policy;
-- only admins (and the service role, which bypasses RLS) may read/write it directly.
-- ---------------------------------------------------------------------------
create policy "site_settings_admin_all" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Public-safe projection of site_settings, excluding every Cashfree/Gemini secret column.
create view public.site_settings_public
  with (security_invoker = true) as
  select
    shop_name, tagline, phone, whatsapp_number, email,
    address_line1, address_line2, working_hours, map_embed_url,
    gst_number, gst_rate, prices_include_gst, state_name, state_code,
    invoice_prefix, shipping_charge, free_shipping_above,
    feature_reviews, feature_moderate_reviews, feature_require_purchase_to_review,
    feature_visitor_counter, feature_geolocation
  from public.site_settings;

grant select on public.site_settings_public to anon, authenticated;
