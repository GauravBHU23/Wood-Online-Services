# Wood Online Service — Next.js + Supabase migration plan

Source of truth for converting the ASP.NET Core 8 MVC app (`src/WoodOnlineService/`) to
Next.js (App Router) + TypeScript + Supabase (Postgres + Auth + Storage), in `web/`.

The old app stays untouched during the migration — nothing here modifies `src/WoodOnlineService/`.
It is the reference for every business rule; when in doubt, that codebase is correct and this
one should match it, not the other way round.

## Status: Phase 1 (foundation) — done

- [x] Next.js 16 App Router + TypeScript + Tailwind scaffolded in `web/`
- [x] Supabase schema (`web/supabase/migrations/0001_init_schema.sql`) — every table from
      `Models/*.cs`, enums matching the C# enums, triggers for denormalised rating and
      auto-created profile row
- [x] RLS policies (`0002_rls_policies.sql`) — mirrors "every order/review/payment query is
      scoped by user id" from the old README's security table
- [x] Seed data (`0003_seed_catalogue.sql`) — the 6 categories / 26 products from `DbSeeder.cs`,
      verbatim
- [x] `src/types/database.ts` — hand-written Supabase `Database` type (regenerate against a
      real project once one exists; see the note at the top of that file about **why** it's
      hand-rolled the way it is — read that before editing it, there's a sharp edge)
- [x] Supabase client helpers: `lib/supabase/{client,server,admin,middleware}.ts`
- [x] `src/proxy.ts` (Next 16's `middleware.ts` replacement) — gates `/account`, `/checkout`,
      `/orders`, `/admin/**` on having a session; role check happens again server-side
- [x] `lib/validation/schemas.ts` — zod schemas mirroring the `[StringLength]`/`[RegularExpression]`
      rules on the C# models, for both client and server validation
- [x] `lib/api-response.ts` — the `{ success, message }` envelope every API route uses
- [x] `lib/data/products.ts`, `lib/data/cart.ts` — first two data-access modules, ported from
      `ShopController` and `Services/CartService.cs`

**A real Supabase project does not exist yet.** Nothing has been deployed or run against a live
database — `npm run build` only proves the TypeScript/Next.js side compiles. See "Before Phase 2"
below.

## A sharp edge you will hit again: postgrest-js + TypeScript

If a `.from(table)` call's result suddenly types as `never` (property-does-not-exist errors on
every field, or `.update()`/`.insert()` rejecting a payload that's obviously correct), it is
almost always one of these two things, both already fixed once in `database.ts` and
`lib/data/{products,cart}.ts` — read the comments at the top of those files before re-deriving
this from scratch:

1. **A table's `Insert`/`Update` types were built through a shared generic helper**
   (`Partial<Row> & Pick<Row, K>`) instead of being spelled out per-table as plain object
   literals. This breaks postgrest-js's conditional-type resolution for `Relation['Update']` the
   *second* time any table is queried anywhere in the same file. Fix: write every table's
   `Insert`/`Update` in full, the way real Supabase codegen does — never factor them through a
   generic.
2. **A table declares `Relationships: []`** but the query embeds a related resource
   (`.select("*, category:categories(*)")`). Without accurate FK metadata in `Relationships`,
   postgrest-js can't verify the join and the embedded field's type becomes
   `SelectQueryError<"could not find the relation...">`, which then fails to satisfy your own
   row type. Fix: declare every FK in `Relationships` (`foreignKeyName`, `columns`,
   `referencedRelation`, `referencedColumns`) — see `database.ts` for the pattern.

Separately (a real, if narrower, TS limitation, not a mistake): never call `.find()`/`.map()`/
spread directly off a query's `data` via `data?.find(...)` or `(data ?? []).map(...)`. Bind it to
an explicitly-typed `const rows: Row[] = data ?? []` first, then call array methods on `rows`.
Chaining straight off the optional `data` expression can make TS infer the element type as
`never` even when the row type is otherwise correct.

**When a real Supabase project exists**, regenerate `database.ts` with
`npx supabase gen types typescript --project-id <ref>` and diff it against the hand-written
version — real codegen output already follows both rules above, so this class of bug should not
recur, but reconcile the seed/RLS-only knowledge (doc comments, the `Table`/`View` shape) back in.

## Remaining phases

Rough size estimate per phase in parentheses — this is a large app; expect this to span many
sessions. Work top-to-bottom; later phases depend on earlier ones.

### Phase 2 — Auth + layout shell (medium)
- Supabase project setup instructions for the user (this agent cannot create one) — hand off
  `.env.example` → `.env.local` with real keys, then apply the 3 migrations via
  `supabase db push` or the SQL editor
- Root layout: header (logo, category nav, search, cart badge, account menu), footer (contact,
  visitor counter, links), matching `Views/Shared/_Layout.cshtml`
- `/account/register`, `/account/login`, `/account/profile` — Supabase Auth email/password,
  replaces ASP.NET Identity. Port lockout behaviour (`SecuritySettings.MaxFailedLoginAttempts`,
  `LockoutMinutes`) — Supabase Auth doesn't do this natively, so it needs a small
  `failed_login_attempts` counter + check in a server action, or defer to Supabase's own rate
  limiting and simplify this rule (flag as a decision point, don't guess)
- Session cookie handling is already wired (`proxy.ts`, `lib/supabase/*`); this phase is mostly
  UI + the register/login/profile forms and server actions

### Phase 3 — Catalogue (medium)
- `/` home page: hero, featured products (`getFeaturedProducts`), categories grid
- `/shop` — full filter/sort/pagination UI over `getShopProducts` (data layer already built)
- `/shop/[id]` product detail — gallery, spec table, related products
  (`getRelatedProducts`), inline inquiry form, reviews list — port from `ShopController.Details`
  (read the rest of that controller past line 140, not yet read in this session)
- Live search API route (`/api/search`) — debounced autocomplete, port from
  `Controllers/Api/SearchApiController.cs`

### Phase 4 — Cart + checkout (medium-large, security-relevant)
- Cart page + add/update/remove server actions (data layer already built in `lib/data/cart.ts`)
- Checkout: address form (pre-filled from profile), COD vs online payment choice
- **Cashfree integration** (`lib/payments/cashfree.ts`, ported from `Services/CashfreeService.cs`):
  order creation, `payment_session_id` handoff to Cashfree's client SDK, `/api/payment/webhook`
  route with **HMAC-SHA256(timestamp + rawBody, clientSecret)** signature verification exactly as
  documented in the old README's Payments section — this is the highest-risk piece to get wrong;
  re-read `Services/CashfreeService.cs` in full again when building this, don't work from memory
- `PaymentReconciliationService.cs` equivalent — a scheduled job or route that re-queries Cashfree
  for any transaction stuck `Pending`, since the browser return URL is only ever a hint
- Order placement (`lib/data/orders.ts`, port of `OrderService.cs`): stock re-check, order number
  generation, cart clearing, all in one transaction — Postgres doesn't have EF's
  "retrying execution strategy" concern, but the transaction still needs to be atomic; use a
  Postgres function (`plpgsql`) called via `rpc()` for this, not multiple round-trips, so a crash
  mid-checkout can't half-apply

### Phase 5 — Orders, reviews, inquiries (medium)
- `/orders`, `/orders/[id]` — history, status tracker, cancellation with stock return, invoice
  view/print (port `InvoiceService.cs`'s GST/CGST/SGST/IGST math from `SiteSettings`)
- Reviews: submit/edit (one per product per user, `UNIQUE(product_id, user_id)` already in
  schema), helpful vote, moderation queue feed for admin
- Inquiry form (product page + standalone) → `inquiries` table

### Phase 6 — Admin panel (large)
- `/admin/**` route group, gated by `profiles.role = 'admin'` (checked server-side per the
  comment in `proxy.ts`)
- Dashboard, Products CRUD (+ image upload to Supabase Storage, replaces `wwwroot/uploads`),
  Categories CRUD, Orders management, Inquiries workflow, Reviews moderation, Users
- **Admin OTP second factor** (`admin_login_otps` table already in schema) — port
  `Services/AdminOtpService.cs`: email a 6-digit code after password checks out, hash it
  (never store the raw code), expire it, cap failed attempts

### Phase 7 — Email, chatbot, visitor counter, PWA (medium)
- Transactional email (order placed/paid/failed, review notifications, welcome) — pick an SMTP
  or email-API library; port `Services/EmailTemplates.cs`'s HTML templates and the event table
  from the old README's Email section
- Gemini-backed chatbot (`Services/ChatbotService.cs` + `GeminiService.cs`) — keyword-matched
  facts from the DB, optionally phrased by Gemini; **never** let the model answer from anything
  but the facts block, same constraint as the original system instruction
- Visitor counter footer widget + geolocation (`VisitorService.cs`) — `visitor_logs`/
  `visitor_counter` tables already in schema
- PWA manifest, service worker, offline page (`Features.EnablePwa`)

### Phase 8 — Hardening pass (before going live)
- Rate limiting equivalent to the old `general`/`sensitive`/`webhook` policies (middleware/proxy
  level, or Supabase's own, or a small in-memory/Upstash limiter — decide based on hosting target)
- Security headers (the old README's table: CSP, X-Frame-Options, etc.) via `next.config.ts`
  headers or proxy
- Re-verify every RLS policy against the finished feature set — a policy written against a
  guessed access pattern in Phase 1 may not match how a later phase actually queries a table
- Cashfree **Live** mode checklist from the old README (domain whitelisting, webhook URL,
  one real low-value test order) — do this only when the user is ready to take real payments

## Conventions to keep consistent across phases

- **Every API route returns `{ success, message, data? }`** via `lib/api-response.ts` — this is
  load-bearing for a consistent toast/error UI, don't ad-hoc a different shape in a later phase.
- **Money is `numeric(18,2)`** in Postgres and a plain `number` in TypeScript (not a Decimal
  library) — matches the precision the old app needed and keeps the data layer simple. Format
  with `lib/utils/format.ts#formatInr`, never hand-roll `₹` string concatenation.
- **RLS is the authorization boundary**, not application code. A Server Component using
  `lib/supabase/server.ts`'s client is automatically scoped to the signed-in user — resist the
  urge to add a redundant `.eq("user_id", ...)` "just in case" that could mask a policy bug;
  fix the policy instead if data leaks.
- **The service-role client (`lib/supabase/admin.ts`) is server-only** and only for the specific
  cases documented in its own comment (checkout, webhook, guest cart, admin OTP). Don't reach for
  it just to avoid writing an RLS policy — that defeats the point of RLS.
