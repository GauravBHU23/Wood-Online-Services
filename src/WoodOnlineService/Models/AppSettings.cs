namespace WoodOnlineService.Models;

public enum PaymentMode
{
    /// <summary>Online payment is switched off; checkout offers Cash on Delivery only.</summary>
    Disabled = 0,

    /// <summary>
    /// Local gateway stand-in. Exercises the whole flow — payment record, redirect, callback,
    /// order confirmation, emails — without contacting Cashfree and without moving money.
    /// Cashfree cannot reach localhost, so this is the only way to test the flow on a workstation.
    /// </summary>
    Simulated = 1,

    /// <summary>Real Cashfree. Requires public HTTPS so the gateway can deliver its webhook.</summary>
    Live = 2
}

/// <summary>
/// Cashfree Payment Gateway credentials. Keep real keys out of source control — put them in
/// appsettings.Production.json, Azure App Settings, or environment variables.
/// </summary>
public class CashfreeSettings
{
    /// <summary>Disabled, Simulated or Live. See <see cref="PaymentMode"/>.</summary>
    public PaymentMode Mode { get; set; } = PaymentMode.Disabled;

    /// <summary>x-client-id, from Cashfree Merchant Dashboard → Developers → API Keys.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>x-client-secret. Also the key used to verify webhook signatures.</summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>https://api.cashfree.com/pg for production, https://sandbox.cashfree.com/pg for test.</summary>
    public string BaseUrl { get; set; } = "https://api.cashfree.com/pg";

    /// <summary>Pinned Cashfree API contract version sent as the x-api-version header.</summary>
    public string ApiVersion { get; set; } = "2026-01-01";

    /// <summary>Public origin used to build the return and webhook (notify) URLs, e.g. https://woodonline.azurewebsites.net</summary>
    public string SiteBaseUrl { get; set; } = string.Empty;

    public bool IsSimulated => Mode == PaymentMode.Simulated;

    /// <summary>True when online payment should be offered at checkout.</summary>
    public bool IsConfigured =>
        Mode == PaymentMode.Simulated ||
        (Mode == PaymentMode.Live &&
         !string.IsNullOrWhiteSpace(ClientId) &&
         !string.IsNullOrWhiteSpace(ClientSecret));

    /// <summary>Explains why live mode is not usable, or null when it is fine.</summary>
    public string? LiveConfigurationProblem
    {
        get
        {
            if (Mode != PaymentMode.Live) return null;

            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(ClientId)) missing.Add("ClientId");
            if (string.IsNullOrWhiteSpace(ClientSecret)) missing.Add("ClientSecret");
            if (missing.Count > 0) return "Missing Cashfree " + string.Join(", ", missing) + ".";

            if (string.IsNullOrWhiteSpace(SiteBaseUrl))
                return "Cashfree:SiteBaseUrl is not set.";

            // The gateway calls these URLs from the public internet.
            if (SiteBaseUrl.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
                SiteBaseUrl.Contains("127.0.0.1", StringComparison.Ordinal))
            {
                return "Cashfree:SiteBaseUrl points at localhost, which Cashfree cannot reach. " +
                       "Use Simulated mode locally, or deploy behind a public HTTPS domain.";
            }

            return null;
        }
    }
}

public class SecuritySettings
{
    /// <summary>Requests per window, per IP, for general browsing.</summary>
    public int GeneralRateLimit { get; set; } = 100;

    /// <summary>Much tighter budget for login/register/checkout endpoints.</summary>
    public int SensitiveRateLimit { get; set; } = 10;

    public int RateLimitWindowSeconds { get; set; } = 60;

    public int MaxFailedLoginAttempts { get; set; } = 3;

    /// <summary>How long a customer account is locked after MaxFailedLoginAttempts wrong passwords.</summary>
    public int LockoutMinutes { get; set; } = 10;

    /// <summary>Admin accounts lock for longer on the same attempt budget — a compromised admin password is a bigger deal.</summary>
    public int AdminLockoutMinutes { get; set; } = 30;

    /// <summary>Extra origins allowed by CORS. Empty means same-origin only, which is the default.</summary>
    public string[] AllowedOrigins { get; set; } = [];

    public bool EnableSecurityHeaders { get; set; } = true;
    public bool RequireHttps { get; set; } = true;
}

public class FeatureSettings
{
    public bool EnableReviews { get; set; } = true;

    /// <summary>When true an admin must approve each review before it appears publicly.</summary>
    public bool ModerateReviews { get; set; } = true;

    /// <summary>When true only customers who bought the product may review it.</summary>
    public bool RequirePurchaseToReview { get; set; }

    public bool EnableVisitorCounter { get; set; } = true;
    public bool EnableGeoLocation { get; set; } = true;
    public bool EnablePwa { get; set; } = true;
}

/// <summary>
/// Google Gemini credentials for the chatbot's natural-language phrasing. Keep the real key out
/// of source control — it belongs in appsettings.Production.json, Azure App Settings, or
/// appsettings.Development.json (gitignored).
/// </summary>
public class GeminiSettings
{
    public bool Enabled { get; set; }

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Free-tier model id, e.g. gemini-3.5-flash-lite.</summary>
    public string Model { get; set; } = "gemini-3.5-flash-lite";

    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta/models/";

    public bool IsConfigured => Enabled && !string.IsNullOrWhiteSpace(ApiKey);
}
