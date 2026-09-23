-- Single-device session enforcement, ported from ApplicationUser.CurrentSessionId +
-- Program.cs's OnValidatePrincipal + SessionClaimsPrincipalFactory.cs.
--
-- The original stamped a fresh CurrentSessionId onto the user record on every sign-in and into
-- the auth cookie's claims; on every request, a cookie whose session id didn't match the user
-- record's current value was rejected, signing that (now-superseded) device out on its very next
-- request. This is a real, user-visible security feature ("signing in on your phone signs you
-- out on your laptop"), not just an implementation detail — Supabase Auth allows unlimited
-- concurrent sessions per user with no automatic equivalent, so it's re-implemented here:
--   - lib/auth/session.ts stamps a fresh id into this column on every successful sign-in
--     (customer login, admin login+OTP) and into a same-shape httpOnly cookie on the response.
--   - src/proxy.ts compares the cookie's id against this column on every request for a
--     signed-in user; a mismatch means another sign-in has since happened elsewhere, so this
--     device's session is rejected there (mirroring OnValidatePrincipal exactly).
--   - Admin-issued blocks (UsersController.cs:155's force-logout-other-devices behavior) also
--     rotate this column, so an already-active session is cut on its very next request rather
--     than surviving until its access token naturally expires.

alter table public.profiles add column if not exists current_session_id text;

comment on column public.profiles.current_session_id is
  'Opaque id stamped fresh on every sign-in; src/proxy.ts rejects any request whose wos_session_id cookie does not match this value, enforcing one signed-in device per account (ported from ApplicationUser.CurrentSessionId).';
