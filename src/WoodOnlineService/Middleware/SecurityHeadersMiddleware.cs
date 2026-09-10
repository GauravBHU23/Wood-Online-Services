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

        // 'unsafe-inline' is required because the views carry inline handlers and styles.
        // frame-src allows the Instamojo checkout window and the Google Maps embed. The maps
        // URL redirects from maps.google.com to www.google.com/maps/embed, and CSP is applied
        // to the final URL, so both hosts have to be permitted - hence the wildcard.
        // img-src data: covers the inlined SVG icons.
        var csp = string.Join("; ",
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-src 'self' https://www.instamojo.com https://test.instamojo.com https://*.google.com https://*.google.co.in",
            "form-action 'self' https://www.instamojo.com https://test.instamojo.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "object-src 'none'");

        // Report-only in development so a tightened policy never blocks local debugging.
        headers[_env.IsDevelopment() ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy"] = csp;

        await _next(context);
    }
}
