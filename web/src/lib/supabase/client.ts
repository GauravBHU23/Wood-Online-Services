"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client. Uses the public anon key, so it is subject to
 * every RLS policy in supabase/migrations/0002_rls_policies.sql — it can never
 * see another customer's cart, orders, or the site_settings secret columns.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
