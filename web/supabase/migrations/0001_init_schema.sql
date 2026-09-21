-- ============================================================================
-- Wood Online Service — initial schema
-- Ported from the ASP.NET Core / EF Core model (src/WoodOnlineService/Models, Data/ApplicationDbContext.cs)
--
-- Auth: Supabase Auth (auth.users) replaces ASP.NET Identity. A public.profiles table
-- (1:1 with auth.users) carries the app-specific fields that used to live on ApplicationUser
-- (FullName, Address, City, State, PinCode, role, MustChangePassword).
--
-- Money columns use numeric(18,2) to match the original decimal(18,2).
-- Row Level Security is enabled on every table; policies are added in 0002_rls_policies.sql
-- so schema and access-control review stay separate.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive email compare

-- ---------------------------------------------------------------------------
-- Enums  (mirrors the C# enums exactly, including numeric intent via ordering)
-- ---------------------------------------------------------------------------
create type app_role as enum ('customer', 'admin');

create type inquiry_status as enum ('new', 'contacted', 'closed');

create type order_status as enum ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');

create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');

create type payment_method as enum ('cod', 'online');

create type transaction_status as enum ('created', 'pending', 'success', 'failed', 'refunded');

create type review_status as enum ('pending', 'approved', 'rejected');

create type payment_mode as enum ('disabled', 'simulated', 'live');

-- ---------------------------------------------------------------------------
-- profiles — 1:1 extension of auth.users (replaces ApplicationUser's custom fields)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text not null default '',
  address               text,
  city                  text,
  state                 text,
  pin_code              text,
  role                  app_role not null default 'customer',
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now()
);
comment on table public.profiles is 'Extends auth.users with app fields; row created by handle_new_user() trigger.';

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id             bigint generated always as identity primary key,
  name           text not null check (char_length(name) <= 100),
  description    text check (char_length(description) <= 500),
  image_url      text check (char_length(image_url) <= 300),
  display_order  int not null default 0,
  is_active      boolean not null default true
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id                bigint generated always as identity primary key,
  name              text not null check (char_length(name) <= 200),
  category_id       bigint not null references public.categories(id) on delete restrict,
  wood_type         text check (char_length(wood_type) <= 100),
  description       text check (char_length(description) <= 2000),
  price             numeric(18,2) not null default 0 check (price >= 0 and price <= 10000000),
  old_price         numeric(18,2) check (old_price is null or old_price >= 0),
  dimensions        text check (char_length(dimensions) <= 150),
  image_url         text check (char_length(image_url) <= 300),
  stock_quantity    int not null default 0 check (stock_quantity >= 0 and stock_quantity <= 100000),
  is_available      boolean not null default true,
  is_featured       boolean not null default false,
  is_custom_order   boolean not null default false,
  created_at        timestamptz not null default now(),
  average_rating    numeric(3,2) not null default 0,
  review_count      int not null default 0
);

create index products_category_id_idx on public.products (category_id);
create index products_is_featured_idx on public.products (is_featured);
create index products_name_idx on public.products (name);
create index products_available_category_idx on public.products (is_available, category_id);
create index products_average_rating_idx on public.products (average_rating);
-- Full-text search over name + description + wood_type, backing the live search API.
alter table public.products add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(wood_type, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;
create index products_search_vector_idx on public.products using gin (search_vector);

-- ---------------------------------------------------------------------------
-- product_images (gallery; product.image_url remains the main image)
-- ---------------------------------------------------------------------------
create table public.product_images (
  id             bigint generated always as identity primary key,
  product_id     bigint not null references public.products(id) on delete cascade,
  image_path     text not null check (char_length(image_path) <= 300),
  alt_text       text check (char_length(alt_text) <= 200),
  display_order  int not null default 0
);
create index product_images_product_id_idx on public.product_images (product_id);

-- ---------------------------------------------------------------------------
-- inquiries
-- ---------------------------------------------------------------------------
create table public.inquiries (
  id           bigint generated always as identity primary key,
  name         text not null check (char_length(name) <= 100),
  phone        text not null check (phone ~ '^[0-9+\-\s]{7,20}$'),
  email        citext check (email is null or char_length(email) <= 150),
  product_id   bigint references public.products(id) on delete set null,
  message      text not null check (char_length(message) <= 2000),
  status       inquiry_status not null default 'new',
  admin_notes  text check (char_length(admin_notes) <= 1000),
  created_at   timestamptz not null default now()
);
create index inquiries_status_idx on public.inquiries (status);
create index inquiries_created_at_idx on public.inquiries (created_at);

-- ---------------------------------------------------------------------------
-- orders / order_items
-- ---------------------------------------------------------------------------
create table public.orders (
  id                bigint generated always as identity primary key,
  order_number      text not null unique check (char_length(order_number) <= 30),
  user_id           uuid not null references auth.users(id) on delete restrict,
  order_date        timestamptz not null default now(),

  shipping_name      text not null check (char_length(shipping_name) <= 100),
  shipping_phone     text not null check (shipping_phone ~ '^[0-9+\-\s]{7,20}$'),
  shipping_address   text not null check (char_length(shipping_address) <= 300),
  shipping_city      text not null check (char_length(shipping_city) <= 100),
  shipping_state     text not null check (char_length(shipping_state) <= 100),
  shipping_pin_code  text not null check (shipping_pin_code ~ '^\d{6}$'),
  notes              text check (char_length(notes) <= 500),

  sub_total       numeric(18,2) not null default 0,
  shipping_charge numeric(18,2) not null default 0,
  total_amount    numeric(18,2) not null default 0,

  payment_method    payment_method not null default 'cod',
  payment_status    payment_status not null default 'pending',
  order_status      order_status not null default 'pending',
  payment_reference text check (char_length(payment_reference) <= 100),
  tracking_number   text check (char_length(tracking_number) <= 100),

  shipped_date    timestamptz,
  delivered_date  timestamptz
);
create index orders_user_id_idx on public.orders (user_id);
create index orders_order_status_idx on public.orders (order_status);

create table public.order_items (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.orders(id) on delete cascade,
  product_id    bigint not null references public.products(id) on delete restrict,
  product_name  text not null check (char_length(product_name) <= 200),
  unit_price    numeric(18,2) not null,
  quantity      int not null check (quantity > 0)
);
create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- cart_items — CartKey pattern kept as `cart_key` ('user:<uuid>' or 'guest:<uuid>')
-- ---------------------------------------------------------------------------
create table public.cart_items (
  id          bigint generated always as identity primary key,
  cart_key    text not null check (char_length(cart_key) <= 100),
  product_id  bigint not null references public.products(id) on delete cascade,
  quantity    int not null check (quantity > 0),
  added_at    timestamptz not null default now(),
  unique (cart_key, product_id)
);
create index cart_items_cart_key_idx on public.cart_items (cart_key);

-- ---------------------------------------------------------------------------
-- reviews / review_votes
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                    bigint generated always as identity primary key,
  product_id            bigint not null references public.products(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  author_name           text not null check (char_length(author_name) <= 100),
  rating                int not null check (rating between 1 and 5),
  title                 text check (char_length(title) <= 150),
  comment               text not null check (char_length(comment) between 10 and 2000),
  is_verified_purchase  boolean not null default false,
  status                review_status not null default 'pending',
  helpful_count         int not null default 0,
  created_at            timestamptz not null default now(),
  moderated_at          timestamptz,
  admin_response        text check (char_length(admin_response) <= 500),
  unique (product_id, user_id)
);
create index reviews_status_idx on public.reviews (status);
create index reviews_created_at_idx on public.reviews (created_at);

create table public.review_votes (
  id          bigint generated always as identity primary key,
  review_id   bigint not null references public.reviews(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (review_id, user_id)
);

-- ---------------------------------------------------------------------------
-- site_feedback
-- ---------------------------------------------------------------------------
create table public.site_feedback (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  author_name         text not null check (char_length(author_name) <= 100),
  rating              int not null check (rating between 1 and 5),
  comment             text not null check (char_length(comment) between 5 and 1000),
  from_welcome_prompt boolean not null default false,
  created_at          timestamptz not null default now(),
  admin_response      text check (char_length(admin_response) <= 500)
);

-- ---------------------------------------------------------------------------
-- payment_transactions
-- ---------------------------------------------------------------------------
create table public.payment_transactions (
  id                  bigint generated always as identity primary key,
  order_id            bigint not null references public.orders(id) on delete cascade,
  payment_request_id  text check (char_length(payment_request_id) <= 100),
  payment_id          text check (char_length(payment_id) <= 100),
  amount              numeric(18,2) not null default 0,
  currency            text not null default 'INR' check (char_length(currency) <= 20),
  status              transaction_status not null default 'created',
  payment_method      text check (char_length(payment_method) <= 50),
  failure_reason      text check (char_length(failure_reason) <= 500),
  payment_url         text check (char_length(payment_url) <= 300),
  is_webhook_verified boolean not null default false,
  gateway_response    text check (char_length(gateway_response) <= 4000),
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);
create index payment_transactions_request_id_idx on public.payment_transactions (payment_request_id);
create index payment_transactions_payment_id_idx on public.payment_transactions (payment_id);
create index payment_transactions_status_idx on public.payment_transactions (status);

-- ---------------------------------------------------------------------------
-- admin_login_otps — second factor after an admin's password checks out
-- ---------------------------------------------------------------------------
create table public.admin_login_otps (
  id               bigint generated always as identity primary key,
  public_token     uuid not null default gen_random_uuid() unique,
  user_id          uuid not null references auth.users(id) on delete cascade,
  code_hash        text not null check (char_length(code_hash) <= 64),
  expires_at       timestamptz not null,
  is_used          boolean not null default false,
  failed_attempts  int not null default 0,
  created_at       timestamptz not null default now()
);
create index admin_login_otps_user_id_idx on public.admin_login_otps (user_id);

-- ---------------------------------------------------------------------------
-- visitor_logs / visitor_counter
-- ---------------------------------------------------------------------------
create table public.visitor_logs (
  id            bigint generated always as identity primary key,
  ip_address    text not null check (char_length(ip_address) <= 64),
  city          text check (char_length(city) <= 100),
  region        text check (char_length(region) <= 100),
  country       text check (char_length(country) <= 100),
  country_code  text check (char_length(country_code) <= 10),
  user_agent    text check (char_length(user_agent) <= 300),
  landing_page  text check (char_length(landing_page) <= 300),
  referrer      text check (char_length(referrer) <= 300),
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  page_views    int not null default 1
);
create index visitor_logs_ip_idx on public.visitor_logs (ip_address);
create index visitor_logs_first_seen_idx on public.visitor_logs (first_seen);

create table public.visitor_counter (
  id                bigint generated always as identity primary key,
  total_visits      bigint not null default 0,
  total_page_views  bigint not null default 0,
  last_updated      timestamptz not null default now()
);
insert into public.visitor_counter (total_visits, total_page_views) values (0, 0);

-- ---------------------------------------------------------------------------
-- site_settings — single-row table (replaces the appsettings.json SiteSettings section)
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id                    int primary key default 1 check (id = 1),
  shop_name             text not null default 'Wood Online Service',
  tagline               text not null default 'Handcrafted Wooden Furniture',
  phone                 text not null default '+91 00000 00000',
  whatsapp_number       text not null default '910000000000',
  email                 text not null default 'info@example.com',
  address_line1         text not null default 'Shop Address Line 1',
  address_line2         text not null default 'City, State - PIN',
  working_hours         text not null default 'Mon - Sat, 10:00 AM - 8:00 PM',
  map_embed_url         text not null default '',
  site_base_url         text not null default '',
  gst_number            text not null default '',
  gst_rate              numeric(5,2) not null default 0,
  prices_include_gst    boolean not null default true,
  state_name            text not null default 'Bihar',
  state_code            text not null default '10',
  pan_number            text not null default '',
  bank_name             text not null default '',
  bank_account_number   text not null default '',
  bank_ifsc             text not null default '',
  upi_id                text not null default '',
  invoice_prefix        text not null default 'INV',
  shipping_charge       numeric(18,2) not null default 500,
  free_shipping_above   numeric(18,2) not null default 20000,
  -- Cashfree + Gemini + feature flags, kept server-side only (never selected by anon/authenticated roles)
  cashfree_mode           payment_mode not null default 'disabled',
  cashfree_client_id      text not null default '',
  cashfree_client_secret  text not null default '',
  cashfree_base_url       text not null default 'https://api.cashfree.com/pg',
  cashfree_api_version    text not null default '2026-01-01',
  gemini_enabled          boolean not null default false,
  gemini_api_key          text not null default '',
  gemini_model            text not null default 'gemini-3.5-flash-lite',
  feature_reviews             boolean not null default true,
  feature_moderate_reviews    boolean not null default true,
  feature_require_purchase_to_review boolean not null default false,
  feature_visitor_counter     boolean not null default true,
  feature_geolocation         boolean not null default true
);
insert into public.site_settings (id) values (1);

-- ============================================================================
-- Updated-at / denormalised-rating triggers
-- ============================================================================

-- Recompute Product.average_rating / review_count whenever an approved review changes,
-- mirroring ReviewService's denormalisation.
create or replace function public.recalc_product_rating() returns trigger as $$
declare
  target_product_id bigint := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set average_rating = coalesce((
        select round(avg(r.rating)::numeric, 2)
        from public.reviews r
        where r.product_id = target_product_id and r.status = 'approved'
      ), 0),
      review_count = (
        select count(*) from public.reviews r
        where r.product_id = target_product_id and r.status = 'approved'
      )
  where p.id = target_product_id;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger reviews_recalc_rating
after insert or update of status, rating or delete on public.reviews
for each row execute function public.recalc_product_rating();

-- Auto-create a profiles row when a new auth user signs up (replaces ApplicationUser defaults).
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
