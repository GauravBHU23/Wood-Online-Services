namespace WoodOnlineService.Services;

/// <summary>
/// Reads the caller's IP the same way the rate limiter does — X-Forwarded-For first (Azure App
/// Service terminates TLS at its own front end, so RemoteIpAddress alone would be that front
/// end's address, not the visitor's), falling back to the raw connection address locally.
/// </summary>
public static class ClientIpHelper
{
    public static string GetIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
            return forwarded.Split(',')[0].Trim();

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
