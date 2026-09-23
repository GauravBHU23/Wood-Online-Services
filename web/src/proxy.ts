import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, clientKeyFor, RATE_LIMIT_MESSAGE, type RateLimitPolicy } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Matches AccountController.cs's actual [Authorize] placement: only Profile and
// ChangePassword require a signed-in user. Login/Register/Logout/ForgotPassword/ResetPassword
// are anonymous-accessible — a blanket "/account" prefix here would redirect the login page to
// itself (returnUrl=/account/login) for a signed-out visitor, an infinite loop.
const PROTECTED_PREFIXES = ["/account/profile", "/account/change-password", "/checkout", "/orders"];
const ADMIN_PREFIX = "/admin";

// Ported from the [EnableRateLimiting("...")] attributes across the original's *ApiControllers —
// see lib/rate-limit.ts for the policy definitions. Only Route Handlers (real, matchable URLs)
// are listed here; the Server Actions behind login/register/checkout/etc. forms rate-limit
// themselves from inside the action (see lib/auth/actions.ts and friends), since every Server
// Action POSTs to its own page's URL and can't be told apart here by path alone.
//
// Order matters: the first prefix match wins, so list longer/more-specific paths first when they
// nest under a shorter one that would otherwise match first (none currently do, but keep this in
// mind when adding routes).
const API_RATE_LIMITS: Array<{ prefix: string; policy: RateLimitPolicy }> = [
  { prefix: "/api/payment/webhook", policy: "webhook" },
  { prefix: "/api/chat/ask", policy: "sensitive" },
  { prefix: "/api/feedback/eligibility", policy: "general" },
  { prefix: "/api/feedback", policy: "sensitive" },
  { prefix: "/api/inquiries", policy: "sensitive" },
  { prefix: "/api/reviews", policy: "sensitive" }, // covers /api/reviews and /api/reviews/[id]/helpful
  { prefix: "/api/cart", policy: "general" },
  { prefix: "/api/chat", policy: "general" }, // /api/chat/greeting (ask is matched above, first)
  { prefix: "/api/payment/status", policy: "general" },
  { prefix: "/api/search", policy: "general" },
  { prefix: "/api/visitor", policy: "general" },
];

// Ported verbatim from Middleware/SecurityHeadersMiddleware.cs — see that file's comments for
// why each CSP directive is shaped the way it is (Cashfree checkout SDK hosts, Google Maps embed
// host vs. redirect-destination host, etc.).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://sdk.cashfree.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com",
  "frame-src 'self' https://payments.cashfree.com https://sdk.cashfree.com https://api.cashfree.com https://maps.google.com https://www.google.com https://maps.google.co.in https://www.google.co.in",
  "form-action 'self' https://payments.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "0"); // Modern browsers: CSP replaces the legacy auditor.
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  // Every dynamically rendered page is marked non-cacheable, same as the original — otherwise a
  // signed-in-only element ("Sign In to review") can be served stale from the browser's
  // back/forward cache after the visitor has since logged in. Static assets (_next/static, image
  // extensions) are excluded from the matcher entirely, so this never fights their own long-lived
  // Cache-Control.
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
  }

  const cspHeaderName =
    process.env.NODE_ENV === "development" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  response.headers.set(cspHeaderName, CSP);

  return response;
}

function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  // JSON for API calls (fetch reads response.json()), the same shape for page requests too —
  // there's no bespoke "too many requests" page in the original either, it just returns 429 with
  // Retry-After and a message, which the browser shows as the raw response.
  const response = NextResponse.json({ success: false, message: RATE_LIMIT_MESSAGE }, { status: 429 });
  response.headers.set("Retry-After", String(retryAfterSeconds || 60));
  return applySecurityHeaders(response);
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // ---------------------------------------------------------------- rate limiting
  // API routes get their specific policy (sensitive/webhook where listed); every other page
  // request falls back to "general", matching the original's two MapControllerRoute calls both
  // being .RequireRateLimiting("general") — i.e. ordinary browsing is limited too, just generously.
  const isCronRoute = path.startsWith("/api/cron");
  if (!isCronRoute) {
    const apiPolicy = API_RATE_LIMITS.find((r) => path.startsWith(r.prefix));
    const policy = apiPolicy?.policy ?? "general";
    const forwardedFor = request.headers.get("x-forwarded-for");
    const clientKey = clientKeyFor(user?.id ?? null, forwardedFor, null);
    const result = await checkRateLimit(clientKey, policy);
    if (!result.allowed) {
      return rateLimitResponse(result.retryAfterSeconds);
    }
  }

  // ---------------------------------------------------------------- single-device session check
  // Ported from Program.cs's OnValidatePrincipal: a signed-in request whose wos_session_id
  // cookie doesn't match the account's current_session_id means another sign-in (or an admin
  // block) has since superseded this device — reject it here, on this very request, same as the
  // original. A profile with no current_session_id yet (rows created before migration 0009, or
  // the rare race where the column read hasn't landed) is treated as not-yet-enforced rather than
  // rejected, so this can never mass-logout everyone the moment it ships.
  if (user) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value ?? null;
    const admin = createAdminClient();
    const profileResult = await admin
      .from("profiles")
      .select("current_session_id")
      .eq("id", user.id)
      .maybeSingle();
    const currentSessionId = (profileResult.data as { current_session_id: string | null } | null)
      ?.current_session_id;

    if (currentSessionId && sessionCookie && currentSessionId !== sessionCookie) {
      const needsAdminHere = path.startsWith(ADMIN_PREFIX) && path !== "/admin/login";
      const url = request.nextUrl.clone();
      url.pathname = needsAdminHere ? "/admin/login" : "/account/login";
      url.searchParams.set("returnUrl", path);
      url.searchParams.set("sessionExpired", "1");
      const redirectResponse = NextResponse.redirect(url);

      redirectResponse.cookies.delete(SESSION_COOKIE);
      // Supabase's own session cookies are named sb-<project-ref>-auth-token (and a
      // -code-verifier variant); clearing every sb-* cookie forces this device to re-authenticate
      // rather than silently keep using a token the server already revoked on the new sign-in.
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-")) redirectResponse.cookies.delete(cookie.name);
      }

      return applySecurityHeaders(redirectResponse);
    }
  }

  // ---------------------------------------------------------------- auth gating
  const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const needsAdmin = path.startsWith(ADMIN_PREFIX) && path !== "/admin/login";

  if ((needsAuth || needsAdmin) && !user) {
    const redirectTo = needsAdmin ? "/admin/login" : "/account/login";
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.searchParams.set("returnUrl", path);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // Role check for /admin/** happens again server-side in the admin layout (via profiles.role) —
  // proxy only gates "is anyone signed in", never authorization, since it cannot cheaply
  // read profiles.role without an extra round trip on every request.

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
