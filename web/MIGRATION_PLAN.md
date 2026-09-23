# Wood Online Service — Next.js + Supabase migration plan

Source of truth for converting the ASP.NET Core 8 MVC app (`src/WoodOnlineService/`) to
Next.js (App Router) + TypeScript + Supabase (Postgres + Auth + Storage), in `web/`.

The old app stays untouched during the migration — nothing here modifies `src/WoodOnlineService/`.
It is the reference for every business rule; when in doubt, that codebase is correct and this
one should match it, not the other way round.

## Status: deployed to Vercel. Phases 1–8 done; a full feature-parity re-audit found and fixed 6 gaps.

Every customer-facing flow, the full admin panel, payments, email, chatbot, and PWA support are
built and ported feature-for-feature from the original. **A real Supabase project exists**
(`tixrybyedvarwsmgoqef`) with migrations 0001–0008 applied and verified against live data;
**migration 0009 (single-device session) is written but not yet applied** — see its own note
below and in that file. `npm run build` / `npx tsc --noEmit` / `npx eslint` all pass clean. Live
at `wood-online-service.vercel.app`.

### Post-launch feature-parity audit (found 6 real gaps, all fixed)

After the first deploy, a full line-by-line re-read of every controller/service in the original
against its Next.js equivalent (not just a skim) turned up 6 genuine gaps — everything else
checked matched. Fixed, in severity order:

1. **Single-device session enforcement was completely missing.** The original stamped a fresh
   `CurrentSessionId` onto the user record on every sign-in and rejected any cookie carrying an
   older id on its very next request (`Program.cs`'s `OnValidatePrincipal`) — "signing in on your
   phone signs you out on your laptop," plus an admin block force-logs-out other devices
   immediately rather than waiting for their token to expire. Supabase Auth has no equivalent.
   Re-implemented: `profiles.current_session_id` (migration `0009`), `lib/auth/session.ts`
   (`completeSignIn` stamps it + revokes other Supabase sessions via
   `admin.signOut(token, 'others')`; `invalidateAllSessions` for the block case), and
   `src/proxy.ts` compares a `wos_session_id` cookie against it on every signed-in request,
   rejecting to `/account/login?sessionExpired=1` on mismatch. **Deliberately fails open**: a
   profile with no `current_session_id` yet (before migration 0009 is applied, or any DB error) is
   treated as not-yet-enforced, never rejected — this can't mass-logout everyone the moment it
   ships, and the whole feature is inert (but harmless) until that migration is applied.
2. **Credential-stuffing IP block used the wrong duration for customer-form failures.** The
   original's `SuspiciousActivityService.RecordFailedAttempt(ip)` takes no duration parameter —
   it's always `AdminLockoutMinutes` (30 min), regardless of which form the failed attempts came
   from. The port had accidentally parameterized it, so customer-form failures only blocked for 10
   minutes. Fixed by hardcoding it again in `lib/auth/suspicious-activity.ts` — don't
   re-parameterize this.
3. **Header search and chatbot search didn't match category names.** Both the original's
   `SearchApiController.Suggest` and `ChatbotService.SearchProductsAsync` match
   `p.Category.Name.Contains(term)` alongside name/wood-type/description; the ports only checked
   the product's own columns. Fixed in `app/api/search/suggest/route.ts` and
   `lib/chatbot/service.ts` by resolving matching category ids first, then folding
   `category_id.in.(...)` into the same `.or()` clause (PostgREST can't filter an embedded
   resource directly in `.or()`).
4. **Admin product/category forms had no field validation**, relying only on Postgres CHECK
   constraints — data integrity was never actually at risk, but a typo (negative price, huge
   description) produced a raw constraint-violation error instead of the original's friendly
   inline "Price must be 0 or more". Added `productSchema`/`categorySchema` to
   `lib/validation/schemas.ts` (ported from `ProductFormViewModel`/`CategoryFormViewModel`'s
   DataAnnotations) and wired them into both the client-side form and the Server Action (client
   check alone isn't a security boundary).
5. **Visitor analytics never recorded `user_agent`/`referrer`** — the columns existed
   (migration 0001) but `lib/data/visitor.ts#recordVisit` never populated them, even though
   `VisitorService.cs` does (truncated to 300 chars, same as `landing_page`). Fixed; no admin UI
   surfaces these in either app, so this was silent, unintentional data loss rather than a
   user-visible bug.
6. **Simulated-payment success email used placeholder values.** `applySimulatedOutcomeAction`
   hardcoded the email's `payment_method`/`payment_id` and the order's persisted
   `payment_reference` instead of reusing the real values generated a few lines earlier — the
   original's `NotifyPaymentSuccessAsync` passes the real transaction through. Simulated-mode-only
   (never hit with `CASHFREE_MODE=live`), fixed by reusing the actual generated values.

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
  periodically by an external scheduler — `vercel.json` wires this up for Vercel Cron already, but
  at `0 3 * * *` (once daily, 3 AM) rather than every 5 minutes: Vercel's **Hobby (free) plan only
  allows daily-or-less-frequent cron schedules**, anything more frequent needs Pro ($20/mo). This
  is only a safety net for webhooks Cashfree failed to deliver — the webhook itself is real-time
  and handles the overwhelming majority of payments instantly, so a daily sweep is an acceptable
  trade-off on the free tier. **If upgrading to Vercel Pro later, change the schedule back to
  `*/5 * * * *`** to match the original's cadence exactly. For another host, point any scheduler
  (Supabase's `pg_cron` + `pg_net`, GitHub Actions on a cron trigger, cron-job.org, etc.)
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

## Before going live (Phase 8)

1. **Create the Supabase project** — done. Project `tixrybyedvarwsmgoqef`, migrations 0001–0008
   applied and verified (categories/products/site_settings_public/storage buckets/rate_limits all
   confirmed via direct REST calls against live data). **Migration
   `0009_single_device_session.sql` is written but NOT YET applied** — paste it into the SQL
   Editor (it's additive, safe to run any time; nothing else depends on it existing, since
   `src/proxy.ts`'s session check fails open — treats a missing/null `current_session_id` as
   not-yet-enforced — if the column is missing).
2. **Manually promote one account to admin** — nothing in the app can do this (by design, so no
   API path can self-elevate). Done: `gauravkum1275@gmail.com` promoted via
   `update public.profiles set role = 'admin' where id = '4b70f059-060e-4e1f-b99d-d5aceed27975';`
   — sign in at `/admin/login`, not the customer `/account/login`.
3. **First real end-to-end run** — done locally (`next dev` and `next start` against the real
   database): homepage/shop/product pages/cart/account pages all verified 200 with real data.
   Register → checkout → admin dashboard flow still needs a manual click-through once an admin
   account exists (step 2).
4. **Rate limiting** — done. Ported as a Postgres-backed fixed-window limiter (`0008_rate_limits.sql`'s
   `check_rate_limit()`, called from `lib/rate-limit.ts`) instead of Upstash/Redis, so it works on
   any host without another paid service. Same three policies and same limits as the original
   (general 100/min, sensitive 10/min, webhook 300/min), same per-user-else-per-IP partitioning.
   Route Handlers are matched by path in `src/proxy.ts`; Server Actions (login/register/
   change-password/forgot-password/place-order/retry-payment) call
   `enforceSensitiveRateLimit()` at their own top, since a Server Action POSTs to its page's own
   URL and proxy.ts can't tell it apart from a plain page load by path alone. Fails open (allows
   the request) if the DB call errors, so a Postgres hiccup degrades to "unlimited", never "down".
5. **Security headers** — done, ported verbatim from `SecurityHeadersMiddleware.cs` into
   `src/proxy.ts` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
   `Permissions-Policy`, `X-XSS-Protection: 0`, no-store `Cache-Control` on every dynamic
   response, and the full CSP — Report-Only in dev, enforced in production). `X-Powered-By` is
   disabled via `next.config.ts`'s `poweredByHeader: false` (Next adds that header after
   middleware runs, so it can't be stripped from proxy.ts).
6. **Re-verify every RLS policy** — done. Cross-checked every table's policy in `0002` against
   how it's actually queried across the shipped code (`grep`-audited every `createClient()` vs
   `createAdminClient()` call site). No gaps found: customer-facing reads (products, categories,
   own orders, own cart, approved reviews) go through the RLS-scoped client and are correctly
   covered by a policy; everything else (admin panel, webhook, guest cart, OTP, visitor tracking)
   deliberately uses the service-role client and bypasses RLS by design, per the documented
   convention.
7. **Cashfree Live mode checklist** (from the original README, still accurate) — **not started**,
   blocked on the user having a live public domain and real Cashfree merchant credentials:
   deploy behind a public HTTPS domain, set `CASHFREE_MODE=live` + real
   `CASHFREE_CLIENT_ID`/`CASHFREE_CLIENT_SECRET`, whitelist the domain in the Cashfree dashboard,
   point its webhook at `{domain}/api/payment/webhook`, place one real low-value test order,
   confirm it flips to Paid, refund it from the Cashfree dashboard before taking real traffic.
   `CASHFREE_MODE=simulated` is fine for launching and taking Cash-on-Delivery orders in the
   meantime — online payment just won't be available until this is done.
8. **Wire up the cron secret** — `vercel.json` already schedules `api/cron/reconcile-payments`
   daily (`0 3 * * *` — see the Phase 7 note above on why not every 5 minutes on Hobby) via
   Vercel Cron; just set `CRON_SECRET` as a Vercel environment variable at deploy time (same value
   as `.env.local`, or a freshly generated one) and confirm the cron fired at least once after
   deploying (Vercel's dashboard → Cron Jobs tab shows run history).
9. **PWA icons** — done (not actually a gap): `public/img/icon-192.png`, `icon-512.png`,
   `icon-maskable-512.png` were copied verbatim from the original app's own assets, which is
   correct per the "pixel-identical" instruction. Only replace them if the shop later wants a
   different icon — that's a cosmetic choice, not a completeness item.
10. **Deploy to Vercel** — not started. See `README.md`'s "Deploying to Vercel" section for the
    step-by-step (root directory must be set to `web/` in the Vercel project import, since this
    repo also contains the untouched original .NET app at its root).

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
- **A new Route Handler that should be rate-limited** gets an entry in `src/proxy.ts`'s
  `API_RATE_LIMITS` array (path prefix → policy). **A new Server Action that should be
  rate-limited** (anything worth brute-forcing — auth, checkout, review/feedback submission)
  calls `enforceSensitiveRateLimit()` from `lib/rate-limit.ts` as its very first line and returns
  immediately if it comes back non-null — see `lib/auth/actions.ts` for the pattern. Don't add a
  new rate-limit policy without a matching one in the original's `Program.cs` /
  `[EnableRateLimiting]` attributes; if the original didn't limit it, don't add a policy here either.
