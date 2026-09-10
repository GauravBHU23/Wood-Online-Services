using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public record PaymentRequestResult(
    bool Success,
    string? PaymentRequestId,
    string? PaymentUrl,
    string? ErrorMessage);

public record PaymentStatusResult(
    bool Success,
    TransactionStatus Status,
    string? PaymentId,
    string? PaymentMethod,
    decimal Amount,
    string? FailureReason,
    string? RawResponse);

public interface IInstamojoService
{
    bool IsEnabled { get; }

    /// <summary>True when payments are handled by the local stand-in instead of Instamojo.</summary>
    bool IsSimulated { get; }

    /// <summary>
    /// True when online payment can actually be taken right now. Stricter than <see cref="IsEnabled"/>:
    /// Live mode also needs a reachable public HTTPS origin, or the gateway's webhook never arrives.
    /// </summary>
    bool IsUsable { get; }

    Task<PaymentRequestResult> CreatePaymentRequestAsync(
        Order order, string buyerName, string email, string phone, CancellationToken ct = default);

    Task<PaymentStatusResult> GetPaymentStatusAsync(string paymentRequestId, CancellationToken ct = default);

    /// <summary>Verifies the HMAC-SHA1 signature Instamojo sends with every webhook.</summary>
    bool VerifyWebhookSignature(IDictionary<string, string> form, string receivedMac);
}

public class InstamojoService : IInstamojoService
{
    private readonly HttpClient _http;
    private readonly InstamojoSettings _settings;
    private readonly ILogger<InstamojoService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public InstamojoService(
        HttpClient http,
        IOptions<InstamojoSettings> settings,
        ILogger<InstamojoService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        _http = http;

        _http.BaseAddress = new Uri(_settings.BaseUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(30);

        if (!string.IsNullOrWhiteSpace(_settings.ApiKey))
        {
            _http.DefaultRequestHeaders.Remove("X-Api-Key");
            _http.DefaultRequestHeaders.Add("X-Api-Key", _settings.ApiKey);
        }

        if (!string.IsNullOrWhiteSpace(_settings.AuthToken))
        {
            _http.DefaultRequestHeaders.Remove("X-Auth-Token");
            _http.DefaultRequestHeaders.Add("X-Auth-Token", _settings.AuthToken);
        }

        var problem = _settings.LiveConfigurationProblem;
        if (problem is not null)
        {
            // Live mode was asked for but cannot work. Say so loudly at startup rather than
            // letting every checkout fail with a vague gateway error.
            _logger.LogWarning("Online payment is set to Live but is not usable. {Problem}", problem);
        }
    }

    public bool IsEnabled => _settings.IsConfigured;

    public bool IsSimulated => _settings.IsSimulated;

    public bool IsUsable => _settings.IsConfigured && _settings.LiveConfigurationProblem is null;

    public async Task<PaymentRequestResult> CreatePaymentRequestAsync(
        Order order, string buyerName, string email, string phone, CancellationToken ct = default)
    {
        if (!IsEnabled)
            return new PaymentRequestResult(false, null, null, "Online payment is not configured.");

        if (_settings.IsSimulated)
            return CreateSimulatedRequest(order);

        var liveProblem = _settings.LiveConfigurationProblem;
        if (liveProblem is not null)
        {
            _logger.LogError("Cannot start payment for {OrderNumber}: {Problem}",
                order.OrderNumber, liveProblem);

            return new PaymentRequestResult(false, null, null,
                "Online payment is not available right now. Please choose Cash on Delivery.");
        }

        var siteBase = _settings.SiteBaseUrl.TrimEnd('/');

        var form = new Dictionary<string, string>
        {
            ["purpose"] = $"Order {order.OrderNumber}",
            ["amount"] = order.TotalAmount.ToString("0.00", CultureInfo.InvariantCulture),
            ["buyer_name"] = Truncate(buyerName, 100),
            ["email"] = email,
            ["phone"] = DigitsOnly(phone),
            ["redirect_url"] = $"{siteBase}/Checkout/PaymentCallback",
            ["webhook"] = $"{siteBase}/api/payment/webhook",
            ["allow_repeated_payments"] = _settings.AllowRepeatedPayments ? "true" : "false",
            ["send_email"] = _settings.SendEmail ? "true" : "false",
            ["send_sms"] = _settings.SendSms ? "true" : "false"
        };

        try
        {
            var (ok, body) = await PostPaymentRequestAsync(form, ct);

            if (!ok)
            {
                // Instamojo rejects some numbers outright (dummy ranges, unusual formats). Phone is
                // optional to the API, so drop it and retry rather than stranding the customer.
                if (RejectedOnPhone(body) && form.Remove("phone"))
                {
                    _logger.LogWarning(
                        "Instamojo rejected the phone number for {OrderNumber}; retrying without it.",
                        order.OrderNumber);

                    (ok, body) = await PostPaymentRequestAsync(form, ct);
                }

                if (!ok)
                {
                    _logger.LogError("Instamojo payment request failed. Body {Body}", Truncate(body, 900));

                    return new PaymentRequestResult(false, null, null, ExtractError(body)
                        ?? "The payment gateway rejected the request. Please try again.");
                }
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            if (!root.TryGetProperty("success", out var successProp) || !successProp.GetBoolean())
            {
                _logger.LogError("Instamojo returned success=false: {Body}", Truncate(body, 900));
                return new PaymentRequestResult(false, null, null, ExtractError(body)
                    ?? "The payment gateway could not create this payment.");
            }

            var request = root.GetProperty("payment_request");
            var id = request.GetProperty("id").GetString();
            var longUrl = request.GetProperty("longurl").GetString();

            _logger.LogInformation("Instamojo payment request {Id} created for order {OrderNumber}",
                id, order.OrderNumber);

            return new PaymentRequestResult(true, id, longUrl, null);
        }
        catch (TaskCanceledException)
        {
            _logger.LogError("Instamojo payment request timed out for order {OrderNumber}", order.OrderNumber);
            return new PaymentRequestResult(false, null, null,
                "The payment gateway did not respond in time. Please try again.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Instamojo payment request threw for order {OrderNumber}", order.OrderNumber);
            return new PaymentRequestResult(false, null, null,
                "We could not reach the payment gateway. Please try again in a moment.");
        }
    }

    public async Task<PaymentStatusResult> GetPaymentStatusAsync(string paymentRequestId, CancellationToken ct = default)
    {
        if (!IsEnabled)
            return new PaymentStatusResult(false, TransactionStatus.Failed, null, null, 0,
                "Online payment is not configured.", null);

        if (_settings.IsSimulated)
        {
            // The simulated gateway writes the outcome straight onto the transaction, so the
            // caller already holds the result and there is nothing to fetch.
            return new PaymentStatusResult(true, TransactionStatus.Pending, null, "Simulated", 0,
                null, "simulated");
        }

        try
        {
            using var response = await _http.GetAsync($"payment-requests/{paymentRequestId}/", ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Instamojo status check failed for {Id}. Status {Status}",
                    paymentRequestId, response.StatusCode);
                return new PaymentStatusResult(false, TransactionStatus.Pending, null, null, 0,
                    "Could not verify the payment status.", Truncate(body, 3900));
            }

            using var doc = JsonDocument.Parse(body);
            var request = doc.RootElement.GetProperty("payment_request");

            decimal.TryParse(
                request.TryGetProperty("amount", out var amt) ? amt.GetString() : "0",
                NumberStyles.Any, CultureInfo.InvariantCulture, out var amount);

            // A request can hold several attempts; the successful one decides the outcome.
            if (request.TryGetProperty("payments", out var payments) &&
                payments.ValueKind == JsonValueKind.Array &&
                payments.GetArrayLength() > 0)
            {
                foreach (var payment in payments.EnumerateArray())
                {
                    var status = payment.TryGetProperty("status", out var s) ? s.GetString() : null;

                    if (string.Equals(status, "Credit", StringComparison.OrdinalIgnoreCase))
                    {
                        return new PaymentStatusResult(
                            true,
                            TransactionStatus.Success,
                            payment.TryGetProperty("payment_id", out var pid) ? pid.GetString() : null,
                            payment.TryGetProperty("instrument_type", out var it) ? it.GetString() : null,
                            amount,
                            null,
                            Truncate(body, 3900));
                    }
                }

                var first = payments[0];
                return new PaymentStatusResult(
                    true,
                    TransactionStatus.Failed,
                    first.TryGetProperty("payment_id", out var fid) ? fid.GetString() : null,
                    first.TryGetProperty("instrument_type", out var fit) ? fit.GetString() : null,
                    amount,
                    first.TryGetProperty("failure", out var f) ? f.ToString() : "Payment was not completed.",
                    Truncate(body, 3900));
            }

            return new PaymentStatusResult(true, TransactionStatus.Pending, null, null, amount,
                null, Truncate(body, 3900));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Instamojo status check threw for {Id}", paymentRequestId);
            return new PaymentStatusResult(false, TransactionStatus.Pending, null, null, 0,
                "Could not verify the payment status.", null);
        }
    }

    /// <summary>
    /// Instamojo signs webhooks by concatenating every posted field except "mac",
    /// ordered by key, joined with "|", then HMAC-SHA1 with the account salt.
    /// </summary>
    public bool VerifyWebhookSignature(IDictionary<string, string> form, string receivedMac)
    {
        if (string.IsNullOrWhiteSpace(_settings.Salt) || string.IsNullOrWhiteSpace(receivedMac))
            return false;

        try
        {
            var payload = string.Join("|", form
                .Where(kv => !string.Equals(kv.Key, "mac", StringComparison.OrdinalIgnoreCase))
                .OrderBy(kv => kv.Key, StringComparer.Ordinal)
                .Select(kv => kv.Value));

            using var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(_settings.Salt));
            var computed = Convert.ToHexString(
                hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();

            // Constant-time compare so a caller can't probe the signature byte by byte.
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(computed),
                Encoding.UTF8.GetBytes(receivedMac.Trim().ToLowerInvariant()));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Webhook signature verification threw");
            return false;
        }
    }

    /// <summary>
    /// Builds a payment request that points at the in-app fake gateway. No network call is made
    /// and no money moves; the customer picks the outcome on the next page.
    /// </summary>
    private PaymentRequestResult CreateSimulatedRequest(Order order)
    {
        var requestId = "SIM-" + Guid.NewGuid().ToString("N")[..16].ToUpperInvariant();

        // Relative URL: the browser resolves it against whatever host the site is served from,
        // so this works on localhost, a LAN address and a deployed domain alike.
        var url = $"/Checkout/SimulatedGateway?requestId={Uri.EscapeDataString(requestId)}";

        _logger.LogInformation(
            "Simulated payment request {RequestId} created for order {OrderNumber} ({Amount:C})",
            requestId, order.OrderNumber, order.TotalAmount);

        return new PaymentRequestResult(true, requestId, url, null);
    }

    /// <summary>Posts the form and returns whether it succeeded along with the response body.</summary>
    private async Task<(bool Ok, string Body)> PostPaymentRequestAsync(
        Dictionary<string, string> form, CancellationToken ct)
    {
        using var content = new FormUrlEncodedContent(form);
        using var response = await _http.PostAsync("payment-requests/", content, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        return (response.IsSuccessStatusCode, body);
    }

    /// <summary>True when the gateway's only complaint was about the phone field.</summary>
    private static bool RejectedOnPhone(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("message", out var message) &&
                   message.ValueKind == JsonValueKind.Object &&
                   message.TryGetProperty("phone", out _);
        }
        catch
        {
            return false;
        }
    }

    private static string DigitsOnly(string input)
    {
        var digits = new string(input.Where(char.IsDigit).ToArray());
        // Instamojo wants a bare 10-digit Indian number; strip a leading 91 or 0.
        if (digits.Length > 10 && digits.StartsWith("91")) digits = digits[2..];
        if (digits.Length > 10 && digits.StartsWith('0')) digits = digits[1..];
        return digits.Length > 10 ? digits[^10..] : digits;
    }

    private static string Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? string.Empty :
        value.Length <= max ? value : value[..max];

    private static string? ExtractError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("message", out var msg))
            {
                // "message" is sometimes a string, sometimes a field -> errors map.
                if (msg.ValueKind == JsonValueKind.String) return msg.GetString();

                if (msg.ValueKind == JsonValueKind.Object)
                {
                    var first = msg.EnumerateObject().FirstOrDefault();
                    if (first.Value.ValueKind == JsonValueKind.Array && first.Value.GetArrayLength() > 0)
                        return $"{first.Name}: {first.Value[0].GetString()}";
                }
            }
        }
        catch
        {
            // Fall through to the caller's generic message.
        }

        return null;
    }
}
