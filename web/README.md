# Wood Online Service — web

Next.js (App Router) + TypeScript + Supabase rewrite of the ASP.NET Core 8 MVC app in
`../src/WoodOnlineService`. See [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md) for the full
phase-by-phase log, architecture notes, and the "before going live" checklist — read that first
when resuming work here.

## Local development

```bash
npm install
npm run dev
```

Requires `.env.local` (gitignored) with real values — copy `.env.example` and fill it in. See
`MIGRATION_PLAN.md` for what each variable does and where to get it.

```bash
npm run build   # production build — also the most reliable way to catch type errors
npm run start   # run the production build locally
npx tsc --noEmit
npx eslint .
```

## Database

All schema/RLS/seed data lives in `supabase/migrations/*.sql`, applied in filename order. Apply
them either with the Supabase CLI (`npx supabase link --project-ref <ref>` once, then
`npx supabase db push`) or by pasting each file into the project's SQL Editor in order, oldest
first. After the first deploy, promote one account to admin:

```sql
update public.profiles set role = 'admin' where id = '<the auth.users.id>';
```

## Deploying to Vercel

1. Push this repo to GitHub (already the case if you're reading this from a clone).
2. In the [Vercel dashboard](https://vercel.com/new), import the repository. When asked for the
   **Root Directory**, set it to `web` (this repo also contains the old, untouched .NET app at
   the repo root — Vercel must build only this folder).
3. Framework preset: Next.js (auto-detected). Build/output settings: leave at the defaults.
4. Add every variable from `.env.example` as a Vercel **Environment Variable** (Project Settings →
   Environment Variables), using your real Supabase/Cashfree/SMTP values — not the placeholders.
   Set `NEXT_PUBLIC_SITE_URL` to the real `https://your-domain` once you know it (a Vercel preview
   URL works too, but Cashfree Live mode needs a stable public domain — see the checklist below).
5. Deploy. Vercel reads `vercel.json` automatically, which schedules
   `api/cron/reconcile-payments` every 5 minutes via Vercel Cron — no extra setup needed there
   beyond `CRON_SECRET` being set (step 4).
6. Once live, run through `MIGRATION_PLAN.md`'s "Before going live" checklist for anything not
   already ticked off (Cashfree Live mode, first real end-to-end order, etc.).

Alternatively, from the CLI (`npx vercel login` then, from this `web/` directory,
`npx vercel --prod`) — the dashboard import is usually simpler for the Root Directory step above.

## Conventions

See the "Conventions kept consistent throughout" section of `MIGRATION_PLAN.md` — API response
shape, money handling, RLS as the authorization boundary, Bootstrap 5 (not Tailwind) for styling.
