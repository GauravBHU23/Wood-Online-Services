namespace WoodOnlineService.Middleware;

/// <summary>
/// Adds the standard hardening headers to every response and strips the ones
/// that advertise the server stack.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IWebHostEnvironment _env;

    public SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment env)
    {
        _next = next;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["X-XSS-Protection"] = "0"; // Modern browsers: CSP replaces the legacy auditor.
        headers["Permissions-Policy"] =
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

        headers.Remove("Server");
        headers.Remove("X-Powered-By");
        headers.Remove("X-AspNet-Version");
        headers.Remove("X-AspNetMvc-Version");

        // Every dynamically rendered page (not a static asset, which sets its own long-lived
        // Cache-Control before this middleware's code below runs) is marked non-cacheable. Without
        // this, a signed-in-only element like "Sign In to review" can be served stale from the
        // browser's back/forward cache after the visitor has since logged in, showing a page that
        // no longer reflects who they are.
        context.Response.OnStarting(() =>
        {
            if (!context.Response.Headers.ContainsKey("Cache-Control"))
            {
                context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
                context.Response.Headers["Pragma"] = "no-cache";
            }
            return Task.CompletedTask;
        });

        // 'unsafe-inline' is required because the views carry inline handlers and styles.
        // script-src allows Cashfree's checkout SDK, which the payment redirect page loads to
        // launch the hosted checkout drop-in. The SDK itself submits a form to
        // api.cashfree.com/pg/view/sessions/checkout (not payments.cashfree.com, despite that
        // being the customer-facing host once the session opens), so form-action has to allow
        // both. frame-src/connect-src allow that same checkout window and its API calls, plus
        // the Google Maps embed. CSP's frame-src is checked against the URL the browser actually
        // navigates the iframe to first — maps.google.com — not just where that then redirects
        // to (www.google.com/maps/embed), so the source host must be allowed too, not only the
        // destination one. Both are pinned explicitly rather than a *.google.com wildcard, which
        // would also cover unrelated Google properties. img-src data: covers the inlined SVG icons.
        var csp = string.Join("; ",
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
            "object-src 'none'");

        // Report-only in development so a tightened policy never blocks local debugging.
        headers[_env.IsDevelopment() ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy"] = csp;

        await _next(context);
    }
}
