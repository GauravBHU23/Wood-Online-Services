using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Middleware;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

var builder = WebApplication.CreateBuilder(args);

// Kestrel writes this header after our middleware runs, so it has to be suppressed here.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// ---------------------------------------------------------------- configuration
builder.Services.Configure<SiteSettings>(builder.Configuration.GetSection("SiteSettings"));
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));
builder.Services.Configure<InstamojoSettings>(builder.Configuration.GetSection("Instamojo"));
builder.Services.Configure<SecuritySettings>(builder.Configuration.GetSection("Security"));
builder.Services.Configure<FeatureSettings>(builder.Configuration.GetSection("Features"));

var security = builder.Configuration.GetSection("Security").Get<SecuritySettings>() ?? new SecuritySettings();

// ---------------------------------------------------------------- database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "No connection string configured. Set ConnectionStrings:DefaultConnection.");

// Production runs on Azure SQL. Development may use SQLite so a workstation needs no
// database install at all; set DatabaseProvider to "SqlServer" to develop against the
// real engine instead. The committed migrations target SQL Server, so on SQLite the
// schema is created directly from the model (see DbSeeder).
var databaseProvider = builder.Configuration["DatabaseProvider"] ?? "SqlServer";
var useSqlite = string.Equals(databaseProvider, "Sqlite", StringComparison.OrdinalIgnoreCase);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    if (useSqlite)
    {
        options.UseSqlite(connectionString);
    }
    else
    {
        options.UseSqlServer(connectionString, sql =>
        {
            // Azure SQL drops idle connections and throttles; retry the transient ones.
            sql.EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), errorNumbersToAdd: null);
            sql.CommandTimeout(30);
        });
    }

    if (builder.Environment.IsDevelopment())
        options.EnableDetailedErrors();
});

// ---------------------------------------------------------------- identity
builder.Services
    .AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireDigit = true;

        options.User.RequireUniqueEmail = true;
        options.SignIn.RequireConfirmedAccount = false;

        options.Lockout.MaxFailedAccessAttempts = security.MaxFailedLoginAttempts;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(security.LockoutMinutes);
        options.Lockout.AllowedForNewUsers = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.ExpireTimeSpan = TimeSpan.FromDays(14);
    options.SlidingExpiration = true;

    options.Cookie.Name = "wos_auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;

    // An expired session on an AJAX call must return 401, not an HTML login page.
    options.Events.OnRedirectToLogin = context =>
    {
        if (IsApiRequest(context.Request))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };

    options.Events.OnRedirectToAccessDenied = context =>
    {
        if (IsApiRequest(context.Request))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        }
        context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
});

// Keeps auth cookies and antiforgery tokens valid across Azure App Service restarts and scale-out.
builder.Services.AddDataProtection()
    .PersistKeysToDbContext<ApplicationDbContext>()
    .SetApplicationName("WoodOnlineService");

// ---------------------------------------------------------------- anti-forgery
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "RequestVerificationToken";
    options.Cookie.Name = "wos_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

// ---------------------------------------------------------------- rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Ordinary browsing.
    options.AddPolicy("general", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: ClientKey(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = security.GeneralRateLimit,
            Window = TimeSpan.FromSeconds(security.RateLimitWindowSeconds),
            QueueLimit = 0
        }));

    // Login, register, checkout, review submission — anything worth brute-forcing.
    options.AddPolicy("sensitive", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: ClientKey(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = security.SensitiveRateLimit,
            Window = TimeSpan.FromSeconds(security.RateLimitWindowSeconds),
            QueueLimit = 0
        }));

    // The payment gateway must never be rate limited out of delivering a webhook.
    options.AddPolicy("webhook", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: ClientKey(context),
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 300,
            Window = TimeSpan.FromSeconds(60),
            QueueLimit = 0
        }));

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = security.RateLimitWindowSeconds.ToString();

        if (IsApiRequest(context.HttpContext.Request))
        {
            context.HttpContext.Response.ContentType = "application/json";
            await context.HttpContext.Response.WriteAsync(
                """{"success":false,"message":"Too many requests. Please wait a moment and try again."}""", ct);
        }
        else
        {
            context.HttpContext.Response.Redirect("/Home/TooManyRequests");
        }
    };
});

// ---------------------------------------------------------------- services
builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("geo");
builder.Services.AddHttpClient<IInstamojoService, InstamojoService>();

builder.Services.AddScoped<IImageService, ImageService>();
builder.Services.AddScoped<ICartService, CartService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<IVisitorService, VisitorService>();
builder.Services.AddScoped<IChatbotService, ChatbotService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();

// Recovers orders whose payment webhook never arrived (app asleep, restart, dropped callback).
builder.Services.AddHostedService<PaymentReconciliationService>();

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        ["application/json", "image/svg+xml", "application/manifest+json"]);
});

builder.Services.AddControllersWithViews(options =>
{
    // Every state-changing POST is CSRF-checked unless it opts out (the payment webhook does).
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
})
.AddViewOptions(options =>
{
    // Client-side validation is handled by data-validate in site.js. Leaving jQuery
    // unobtrusive switched on as well made both write into the same span, so every field
    // showed its error twice. The server still validates every model on every POST.
    options.HtmlHelperOptions.ClientValidationEnabled = false;
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

// [ApiController] returns an RFC-9110 problem document by default. The front end expects a
// single { success, message } envelope for every failure, so model-binding errors are reshaped.
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var message = context.ModelState
            .SelectMany(entry => entry.Value?.Errors ?? new ModelErrorCollection())
            .Select(error => error.ErrorMessage)
            .FirstOrDefault(m => !string.IsNullOrWhiteSpace(m))
            ?? "Please check the details you entered and try again.";

        return new BadRequestObjectResult(new { success = false, message });
    };
});

// Azure App Service terminates TLS at the front end; trust its forwarded headers.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

if (security.RequireHttps && !builder.Environment.IsDevelopment())
{
    builder.Services.AddHsts(options =>
    {
        options.Preload = true;
        options.IncludeSubDomains = true;
        options.MaxAge = TimeSpan.FromDays(365);
    });
}

var app = builder.Build();

// ---------------------------------------------------------------- pipeline
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Home/Error");
    if (security.RequireHttps) app.UseHsts();
}

app.UseMiddleware<GlobalExceptionMiddleware>();

if (security.EnableSecurityHeaders)
    app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseStatusCodePagesWithReExecute("/Home/Error/{0}");

if (security.RequireHttps && !app.Environment.IsDevelopment())
{
    // Azure App Service terminates TLS at its front end and forwards over plain HTTP on a
    // port the app cannot guess, so UseHttpsRedirection has no target port and throws.
    // UseForwardedHeaders has already set Request.Scheme from X-Forwarded-Proto, so redirect
    // on that instead: it needs no port and works behind any reverse proxy.
    app.Use(async (context, next) =>
    {
        if (!context.Request.IsHttps)
        {
            var target = $"https://{context.Request.Host.Host}" +
                         $"{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}";

            context.Response.Redirect(target, permanent: true);
            return;
        }

        await next();
    });
}

app.UseResponseCompression();

app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Fingerprinted assets can be cached hard; the service worker handles updates.
        var headers = ctx.Context.Response.GetTypedHeaders();
        headers.CacheControl = new Microsoft.Net.Http.Headers.CacheControlHeaderValue
        {
            Public = true,
            MaxAge = TimeSpan.FromDays(30)
        };
    }
});

app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "areas",
    pattern: "{area:exists}/{controller=Home}/{action=Index}/{id?}")
   .RequireRateLimiting("general");

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
   .RequireRateLimiting("general");

// ---------------------------------------------------------------- startup
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        await DbSeeder.SeedAsync(app.Services, app.Configuration, logger);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database initialisation failed.");
        if (app.Environment.IsDevelopment()) throw;
    }
}

app.Run();

// ---------------------------------------------------------------- helpers
static bool IsApiRequest(HttpRequest request) =>
    request.Path.StartsWithSegments("/api") ||
    string.Equals(request.Headers["X-Requested-With"], "XMLHttpRequest", StringComparison.OrdinalIgnoreCase) ||
    (request.Headers.Accept.ToString()?.Contains("application/json", StringComparison.OrdinalIgnoreCase) ?? false);

/// <summary>
/// Rate limits are keyed per signed-in user when possible, so several customers behind one
/// office or mobile-carrier NAT do not consume each other's budget.
/// </summary>
static string ClientKey(HttpContext context)
{
    var userId = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    if (!string.IsNullOrEmpty(userId)) return $"u:{userId}";

    var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
    if (!string.IsNullOrWhiteSpace(forwarded))
        return $"ip:{forwarded.Split(',')[0].Trim()}";

    return $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
}

public partial class Program { }
