# Wood Online Service — Next.js + Supabase migration plan

Source of truth for converting the ASP.NET Core 8 MVC app (`src/WoodOnlineService/`) to
Next.js (App Router) + TypeScript + Supabase (Postgres + Auth + Storage), in `web/`.

The old app stays untouched during the migration — nothing here modifies `src/WoodOnlineService/`.
It is the reference for every business rule; when in doubt, that codebase is correct and this
one should match it, not the other way round.

## Status: Phases 1–7 done. Only Phase 8 (hardening, before going live) remains.

Every customer-facing flow, the full admin panel, payments, email, chatbot, and PWA support are
built and ported feature-for-feature from the original. **No Supabase project exists yet** —
nothing has been run against a live database. `npm run build` / `npx tsc --noEmit` / `npx eslint`
all pass clean as of the last commit, which only proves the TypeScript/Next.js side compiles —
see "Before going live" below for what's still needed to actually run this.

### Phase 1 — Foundation
- Supabase schema (`supabase/migrations/0001_init_schema.sql`) — every table from `Models/*.cs`,
  enums matching the C# enums, triggers for denormalised rating and auto-created profile row
- RLS policies (`0002_rls_policies.sql`), seed data (`0003_seed_catalogue.sql`, the original 6
  categories / 26 products verbatim)
- `src/types/database.ts` (hand-written; see the sharp-edge note below), Supabase client helpers,
  `src/proxy.ts`, zod validation schemas, the `{ success, message }` API envelope

### Phase 2 — Auth + layout shell
- Register/login/logout/profile/change-password/forgot-reset-password, all on Supabase Auth
- Per-account lockout + credential-stuffing IP tracking re-implemented (`lib/auth/lockout.ts`,
  `lib/auth/suspicious-activity.ts`; `login_lockouts` table, migration `0004`, keyed by email)
- Admin sign-in: separate page, password-then-email-OTP two-factor (`lib/auth/admin-otp.ts`,
  `admin_login_otps` table)
- Full header/footer/toast/chat-widget/WhatsApp-float chrome, pixel-matched to the original by
  porting `site.css`/`components.css`/`invoice.css` verbatim (`src/styles/`) instead of
  rebuilding the look in Tailwind — **Tailwind was removed**, this app is Bootstrap 5 + those
  files, same class names throughout (`.panel`, `.btn-wood`, `.wos-toast`, etc.)
- Email service + all 9 transactional templates (`lib/email/`), keyword-matched chatbot with
  optional Gemini phrasing (`lib/chatbot/`), visitor tracking + geolocation (`lib/data/visitor.ts`)

### Phase 3 — Catalogue
- Home, `/shop` (filter/sort/pagination as a plain GET form, works without JS), `/shop/[id]`
  product detail with gallery, reviews section, inline inquiry form, related products
- `lib/data/reviews.ts`, `lib/data/inquiries.ts`, cart-add wired end to end

### Phase 4 — Cart, checkout, Cashfree payments
- Cart page, checkout form, **atomic order placement** via a Postgres function
  (`place_order()`, migration `0005`) — stock re-check, order + items insert, stock decrement,
  cart clear all in one transaction, so a crash mid-checkout can't half-apply
- Cashfree integration (`lib/payments/cashfree.ts`): order creation, hosted-checkout handoff,
  Simulated/Live/Disabled modes, `liveConfigurationProblem()` localhost-detection guard
- Webhook (`api/payment/webhook`) — the highest-risk piece, built to match the original exactly:
  raw body only, HMAC-SHA256(timestamp + rawBody, clientSecret) constant-time verification,
  ±5-minute freshness window, idempotent against retries, order status only ever advances
- Payment callback (re-verifies with Cashfree's API, never trusts browser query params),
  simulated gateway for local dev, status polling, retry-payment

### Phase 5 — Orders, invoice/GST, static pages
- Order history/detail/cancel/retry, payment-status poller
- Invoice (`lib/data/invoice.ts`, ported from `InvoiceService.cs`): CGST/SGST/IGST math,
  inclusive-vs-exclusive GST pricing, inter-state IGST split, Tax/Proforma Invoice title logic,
  Indian-numbering (lakh/crore) amount-in-words — rendered standalone at `/invoice/[id]`
  (outside the `(site)` route group, so it has no header/footer, matching `Layout = null`)
- About, Contact, Thank You, Privacy, Terms, License

### Phase 6 — Admin panel
- Full shell with live badge counts, role re-verified server-side on every load
  (`lib/auth/require-admin.ts`) — proxy.ts only gates "is anyone signed in", never the role itself
- Dashboard, Products (+ Supabase Storage image upload, migration `0006`, with the original's
  extension allow-list/5MB cap/SVG-sanitization all preserved — `lib/admin/image-service.ts`),
  Categories, Orders (status update, auto stock return/restore), Inquiries, Reviews (moderation;
  rating recalculation is now automatic via the DB trigger, not an explicit call), Feedback,
  Users (block/unblock now uses Supabase Auth's own `ban_duration`/`banned_until`)

### Phase 7 — PWA, welcome feedback prompt, payment reconciliation
- Welcome feedback prompt modal, shown once after registration (`sessionStorage` flag +
  `components/shop/feedback-prompt-trigger.tsx`), `api/feedback` + `api/feedback/eligibility`
- PWA: manifest, service worker (`public/sw.js`, adapted for Next's `/_next/static/` asset
  paths), offline page, install-prompt UI (`components/layout/pwa-manager.tsx`) — gated by the
  new `site_settings.feature_pwa` column (migration `0007`, missing from the original's schema
  port and added here)
- Payment reconciliation (`lib/payments/reconciliation.ts`, ported from
  `PaymentReconciliationService.cs`): **this one architecturally differs from the original**,
  which ran as an in-process `BackgroundService` polling every 5 minutes. Next.js (especially
  serverless deployments) has no equivalent long-running process, so it's exposed as
  `api/cron/reconcile-payments`, bearer-token authenticated (`CRON_SECRET`), meant to be called
  every 5 minutes by an external scheduler — `vercel.json` wires this up for Vercel Cron already;
  for another host, point any scheduler (Supabase's `pg_cron` + `pg_net`, GitHub Actions, etc.)
  at that URL with the same header instead

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

## Before going live (Phase 8 — not started)

1. **Create the Supabase project** (the user chose "give me code, I'll create the project" back
   in Phase 1 — this still hasn't happened). Apply all 7 migrations in order (`supabase db push`
   or paste each into the SQL editor in filename order), then copy the project's URL/anon
   key/service role key into `.env.local` per `.env.example`.
2. **Manually promote one account to admin** — nothing in the app can do this (by design, so no
   API path can self-elevate). After registering normally, run in the SQL editor:
   `update public.profiles set role = 'admin' where id = '<the auth.users.id>';`
3. **First real end-to-end run**: register, browse, add to cart, checkout with
   `CASHFREE_MODE=simulated`, confirm the order/email/invoice flow, then sign in as the promoted
   admin and confirm the dashboard/order-status-update flow.
4. **Rate limiting** — the original had three policies (`general` 100/min, `sensitive` 10/min on
   login/register/checkout/reviews, `webhook` 300/min), keyed per-user when signed in and per-IP
   otherwise. Nothing in this port enforces that yet. Decide the mechanism based on where this
   deploys (Vercel Edge Middleware + Upstash Redis is the natural fit for serverless; a
   Postgres-table token bucket works anywhere) before this handles real traffic.
5. **Security headers** — the original set `X-Frame-Options: DENY`, `X-Content-Type-Options:
   nosniff`, `Referrer-Policy`, `Permissions-Policy`, and a CSP via middleware. Add the
   equivalent via `next.config.ts`'s `headers()` or `src/proxy.ts`.
6. **Re-verify every RLS policy** against the finished feature set — policies in `0002` were
   written before most features existed; check each one still matches how the shipped code
   actually queries each table.
7. **Cashfree Live mode checklist** (from the original README, still accurate): deploy behind a
   public HTTPS domain, set `CASHFREE_MODE=live` + real `CASHFREE_CLIENT_ID`/`CASHFREE_CLIENT_SECRET`,
   whitelist the domain in the Cashfree dashboard, point its webhook at
   `{domain}/api/payment/webhook`, place one real low-value test order, confirm it flips to Paid,
   refund it from the Cashfree dashboard before taking real traffic.
8. **Wire up the cron secret** — set `CRON_SECRET` in the hosting platform's env vars and confirm
   `api/cron/reconcile-payments` is actually being called every 5 minutes (Vercel Cron reads
   `vercel.json` automatically once deployed there; other hosts need their own scheduler pointed
   at the route).
9. **PWA icons** — `public/img/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` were copied
   from the original app's seed assets; replace them if the shop wants its own icon before
   shipping the installable app.

## Conventions kept consistent throughout

- **Every API route returns `{ success, message, data? }`** via `lib/api-response.ts`.
- **Money is `numeric(18,2)`** in Postgres and a plain `number` in TypeScript (not a Decimal
  library). Format with `lib/utils/format.ts#formatInr`, never hand-roll `₹` string concatenation.
- **RLS is the authorization boundary**, not application code. A Server Component using
  `lib/supabase/server.ts`'s client is automatically scoped to the signed-in user — resist the
  urge to add a redundant `.eq("user_id", ...)` "just in case" that could mask a policy bug;
  fix the policy instead if data leaks.
- **The service-role client (`lib/supabase/admin.ts`) is server-only** and only for the specific
  cases documented in its own comment (checkout, webhook, guest cart, admin OTP, admin panel
  reads). Don't reach for it just to avoid writing an RLS policy — that defeats the point of RLS.
- **UI is Bootstrap 5 + the ported `site.css`/`components.css`/`invoice.css`**, not Tailwind
  utility classes — match the existing class names (`.panel`, `.btn-wood`, `.badge-soft`, etc.)
  in any new page rather than introducing a second styling system.
