using System.Text.Json;

namespace WoodOnlineService.Middleware;

/// <summary>
/// Last line of defence: turns any unhandled exception into a JSON envelope for AJAX callers
/// and a friendly page for browsers. A stack trace is never sent to the client in production.
/// </summary>
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        IWebHostEnvironment env,
        ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _env = env;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            var reference = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

            _logger.LogError(ex,
                "Unhandled exception {Reference} on {Method} {Path}",
                reference, context.Request.Method, context.Request.Path);

            if (context.Response.HasStarted)
            {
                // Too late to rewrite the response; the log entry is all we can offer.
                _logger.LogWarning("Response already started for {Reference}; cannot render an error page.", reference);
                throw;
            }

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;

            if (IsApiRequest(context.Request))
            {
                context.Response.ContentType = "application/json";

                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Something went wrong on our side. Please try again.",
                    reference,
                    detail = _env.IsDevelopment() ? ex.Message : null
                }));
            }
            else
            {
                context.Response.Redirect($"/Home/Error?ref={reference}");
            }
        }
    }

    private static bool IsApiRequest(HttpRequest request) =>
        request.Path.StartsWithSegments("/api") ||
        string.Equals(request.Headers["X-Requested-With"], "XMLHttpRequest", StringComparison.OrdinalIgnoreCase) ||
        (request.Headers.Accept.ToString()?.Contains("application/json", StringComparison.OrdinalIgnoreCase) ?? false);
}
