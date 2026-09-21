-- ============================================================================
-- Account lockout support, keyed by email.
--
-- Supabase Auth has no built-in configurable "N failed attempts -> locked for M minutes"
-- policy like ASP.NET Identity had, so it's tracked here and enforced in the login Server
-- Action (src/lib/auth/lockout.ts) by checking this table BEFORE calling
-- supabase.auth.signInWithPassword().
--
-- Keyed by email rather than auth.users.id: the check must run before sign-in even attempts to
-- resolve the account, and the admin API has no "get user by email" lookup (only listUsers()
-- with pagination, or getUserById() once the id is already known) — keying by email avoids
-- needing that extra resolution step.
-- ============================================================================

create table public.login_lockouts (
  email                 citext primary key,
  failed_login_attempts int not null default 0,
  locked_until          timestamptz,
  updated_at            timestamptz not null default now()
);

comment on table public.login_lockouts is
  'Per-email failed sign-in tracking, checked before signInWithPassword(). See lib/auth/lockout.ts.';

alter table public.login_lockouts enable row level security;

-- Service-role only (bypasses RLS) — no anon/authenticated policy at all, so this table is
-- unreachable from the browser or from a user's own session, by design.
