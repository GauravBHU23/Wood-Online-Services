import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client — bypasses RLS entirely. Server-only:
 * SUPABASE_SERVICE_ROLE_KEY must never be prefixed NEXT_PUBLIC_ and must never
 * reach a Client Component or a response body.
 *
 * Use only for the handful of operations RLS is deliberately not designed to allow
 * from the client's own identity, e.g.:
 *  - the checkout API route (creating an order + its order_items atomically, then
 *    clearing the cart, all after re-checking stock server-side)
 *  - the Cashfree webhook handler (an unauthenticated caller, verified by HMAC
 *    signature instead of a Supabase session)
 *  - admin OTP issuance/verification (admin_login_otps has no client policy at all)
 *  - guest cart operations where there is no auth.uid() to scope a policy against
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from client-side code.");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
