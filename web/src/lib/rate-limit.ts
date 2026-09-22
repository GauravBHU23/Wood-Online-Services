import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Ported from Program.cs's AddRateLimiter. The original ran three in-process fixed-window
// policies (general/sensitive/webhook) backed by .NET's RateLimitPartition, keyed per signed-in
// user when possible and per-IP otherwise (see ClientKey there). Next.js has no shared in-process
// state across invocations (especially on serverless), so the same fixed-window algorithm is
// re-implemented as one atomic Postgres round trip (check_rate_limit(), migration 0008) instead.
//
// general: ordinary browsing/API reads. sensitive: anything worth brute-forcing (login, register,
// checkout, review/feedback submission, contact form, chat). webhook: the Cashfree webhook, which
// must never be throttled out of delivering a payment notification.
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const GENERAL_RATE_LIMIT = 100;
export const SENSITIVE_RATE_LIMIT = 10;
export const WEBHOOK_RATE_LIMIT = 300;

export type RateLimitPolicy = "general" | "sensitive" | "webhook";

const POLICY_LIMITS: Record<RateLimitPolicy, number> = {
  general: GENERAL_RATE_LIMIT,
  sensitive: SENSITIVE_RATE_LIMIT,
  webhook: WEBHOOK_RATE_LIMIT,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Checks and increments the request count for `clientKey` under `policy` in one atomic
 * round trip. Fails OPEN (allowed: true) on any error talking to Postgres — a rate limiter
 * that can take the whole site down when the DB hiccups is worse than one that occasionally
 * lets a burst through, matching the original's intent (protect against abuse, not be a new
 * single point of failure).
 */
export async function checkRateLimit(
  clientKey: string,
  policy: RateLimitPolicy
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const result = await admin.rpc("check_rate_limit", {
      p_client_key: clientKey,
      p_policy: policy,
      p_limit: POLICY_LIMITS[policy],
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (result.error || !result.data || result.data.length === 0) {
      return { allowed: true, remaining: POLICY_LIMITS[policy], retryAfterSeconds: 0 };
    }

    const row = result.data[0];
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
    };
  } catch {
    return { allowed: true, remaining: POLICY_LIMITS[policy], retryAfterSeconds: 0 };
  }
}

/**
 * Same partitioning as the original's ClientKey(): signed-in users are keyed by their own id
 * (so several customers behind one office/mobile-carrier NAT don't share a budget), everyone
 * else by IP (X-Forwarded-For's first hop, same as Kestrel behind a reverse proxy would see).
 */
export function clientKeyFor(userId: string | null, forwardedFor: string | null, remoteIp: string | null): string {
  if (userId) return `u:${userId}`;
  if (forwardedFor) return `ip:${forwardedFor.split(",")[0].trim()}`;
  return `ip:${remoteIp ?? "unknown"}`;
}

export const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again.";

/**
 * For Server Actions only (login/register/change-password/forgot-password/place-order/
 * retry-payment/contact — see each call site). proxy.ts can't tell these apart by path since
 * every Server Action POSTs to its own page's URL, so each action calls this at its top instead,
 * the same way the original decorated each one with [EnableRateLimiting("sensitive")].
 * Returns null when allowed, or the { success: false, message } shape to return immediately.
 */
export async function enforceSensitiveRateLimit(): Promise<{ success: false; message: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const h = await headers();
  const forwarded = h.get("x-forwarded-for");

  const clientKey = clientKeyFor(user?.id ?? null, forwarded, null);
  const result = await checkRateLimit(clientKey, "sensitive");

  if (!result.allowed) {
    return { success: false, message: RATE_LIMIT_MESSAGE };
  }
  return null;
}
