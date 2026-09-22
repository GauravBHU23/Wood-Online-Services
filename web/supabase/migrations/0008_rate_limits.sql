-- Rate limiting, ported from Program.cs's AddRateLimiter (three fixed-window policies: general
-- 100/min, sensitive 10/min, webhook 300/min — see lib/rate-limit.ts for the exact port).
-- ASP.NET's RateLimiter kept these counters in-process memory; Next.js has no equivalent shared
-- process (especially on serverless, where each invocation can be a cold instance), so the
-- counter lives here instead. check_rate_limit() does the read-increment-and-compare atomically
-- in one round trip under a row lock, so concurrent requests from the same client can't both read
-- the count before either writes it back (the classic check-then-increment race).

create table if not exists public.rate_limits (
  client_key text not null,
  policy text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (client_key, policy)
);

-- Rows are looked up by (client_key, policy) on every request; the primary key already covers
-- that access pattern, so no extra index is needed.

alter table public.rate_limits enable row level security;
-- Service-role only (same posture as login_lockouts): no anon/authenticated policy at all, since
-- only the server-side rate limiter itself ever touches this table.

create or replace function public.check_rate_limit(
  p_client_key text,
  p_policy text,
  p_limit integer,
  p_window_seconds integer
) returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  -- Atomic upsert: if the row doesn't exist, or its window has expired, start a fresh window
  -- with count 1 (this request). Otherwise increment in place. The ON CONFLICT DO UPDATE runs
  -- under a row-level lock, so two concurrent requests for the same client_key/policy can never
  -- both see the pre-increment count.
  insert into public.rate_limits (client_key, policy, window_start, request_count)
  values (p_client_key, p_policy, v_now, 1)
  on conflict (client_key, policy) do update
    set window_start = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
          then v_now
          else public.rate_limits.window_start
        end,
        request_count = case
          when public.rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
          then 1
          else public.rate_limits.request_count + 1
        end
  returning public.rate_limits.window_start, public.rate_limits.request_count
  into v_window_start, v_count;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(p_window_seconds - extract(epoch from (v_now - v_window_start))::integer, 0);
end;
$$;

-- Old rows are cheap to keep (one row per distinct client_key+policy in the last window) but
-- unbounded growth from one-off IPs isn't useful to retain — this can be called periodically from
-- the same cron that already exists for payment reconciliation, or just left: at most a few
-- thousand rows for realistic traffic, and each is tiny.
create or replace function public.cleanup_rate_limits() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;
