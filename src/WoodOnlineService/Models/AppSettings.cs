namespace WoodOnlineService.Models;

public enum PaymentMode
{
    /// <summary>Online payment is switched off; checkout offers Cash on Delivery only.</summary>
    Disabled = 0,

    /// <summary>
    /// Local gateway stand-in. Exercises the whole flow — payment record, redirect, callback,
    /// order confirmation, emails — without contacting Instamojo and without moving money.
    /// Instamojo cannot reach localhost, so this is the only way to test the flow on a workstation.
    /// </summary>
    Simulated = 1,

    /// <summary>Real Instamojo. Requires public HTTPS so the gateway can deliver its webhook.</summary>
    Live = 2
}

/// <summary>
/// Instamojo credentials. Keep real keys out of source control — put them in
/// appsettings.Production.json, Azure App Settings, or environment variables.
/// </summary>
public class InstamojoSettings
{
    /// <summary>Disabled, Simulated or Live. See <see cref="PaymentMode"/>.</summary>
    public PaymentMode Mode { get; set; } = PaymentMode.Disabled;

    public string ApiKey { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>Used to verify the webhook HMAC so a forged callback cannot mark an order paid.</summary>
    public string Salt { get; set; } = string.Empty;

    /// <summary>https://www.instamojo.com/api/1.1/ for live, https://test.instamojo.com/api/1.1/ for test.</summary>
    public string BaseUrl { get; set; } = "https://www.instamojo.com/api/1.1/";

    /// <summary>Public origin used to build redirect and webhook URLs, e.g. https://woodonline.azurewebsites.net</summary>
    public string SiteBaseUrl { get; set; } = string.Empty;

    public bool AllowRepeatedPayments { get; set; }
    public bool SendSms { get; set; }
    public bool SendEmail { get; set; } = true;

    public bool IsSimulated => Mode == PaymentMode.Simulated;

    /// <summary>True when online payment should be offered at checkout.</summary>
    public bool IsConfigured =>
        Mode == PaymentMode.Simulated ||
        (Mode == PaymentMode.Live &&
         !string.IsNullOrWhiteSpace(ApiKey) &&
         !string.IsNullOrWhiteSpace(AuthToken) &&
         !string.IsNullOrWhiteSpace(Salt));

    /// <summary>Explains why live mode is not usable, or null when it is fine.</summary>
    public string? LiveConfigurationProblem
    {
        get
        {
            if (Mode != PaymentMode.Live) return null;

            var missing = new List<string>();
            if (string.IsNullOrWhiteSpace(ApiKey)) missing.Add("ApiKey");
            if (string.IsNullOrWhiteSpace(AuthToken)) missing.Add("AuthToken");
            if (string.IsNullOrWhiteSpace(Salt)) missing.Add("Salt");
            if (missing.Count > 0) return "Missing Instamojo " + string.Join(", ", missing) + ".";

            if (string.IsNullOrWhiteSpace(SiteBaseUrl))
                return "Instamojo:SiteBaseUrl is not set.";

            // The gateway calls these URLs from the public internet.
            if (SiteBaseUrl.Contains("localhost", StringComparison.OrdinalIgnoreCase) ||
                SiteBaseUrl.Contains("127.0.0.1", StringComparison.Ordinal))
            {
                return "Instamojo:SiteBaseUrl points at localhost, which Instamojo cannot reach. " +
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

    public int MaxFailedLoginAttempts { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;

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
