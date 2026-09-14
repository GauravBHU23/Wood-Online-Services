using System.Globalization;
using System.Net.Http.Headers;
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

public interface ICashfreeService
{
    bool IsEnabled { get; }

    /// <summary>True when payments are handled by the local stand-in instead of Cashfree.</summary>
    bool IsSimulated { get; }

    /// <summary>
    /// True when online payment can actually be taken right now. Stricter than <see cref="IsEnabled"/>:
    /// Live mode also needs a reachable public HTTPS origin, or the gateway's webhook never arrives.
    /// </summary>
    bool IsUsable { get; }

    /// <summary>Client id the front-end SDK needs to open the checkout drop-in. Empty outside Live mode.</summary>
    string ClientId { get; }

    Task<PaymentRequestResult> CreatePaymentRequestAsync(
        Order order, string buyerName, string email, string phone, CancellationToken ct = default);

    Task<PaymentStatusResult> GetPaymentStatusAsync(string cashfreeOrderId, CancellationToken ct = default);

    /// <summary>Verifies the HMAC-SHA256 signature Cashfree sends with every webhook.</summary>
    bool VerifyWebhookSignature(string rawBody, string timestamp, string receivedSignature);
}

/// <summary>
/// Cashfree Payment Gateway integration (PG API, contract version pinned via
/// <see cref="CashfreeSettings.ApiVersion"/>). Covers UPI, cards, net banking and wallets through
/// Cashfree's hosted checkout, launched client-side with the payment_session_id this service returns.
/// </summary>
public class CashfreeService : ICashfreeService
{
    private readonly HttpClient _http;
    private readonly CashfreeSettings _settings;
    private readonly ILogger<CashfreeService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public CashfreeService(
        HttpClient http,
        IOptions<CashfreeSettings> settings,
        ILogger<CashfreeService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        _http = http;

        _http.BaseAddress = new Uri(_settings.BaseUrl.TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(30);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        if (!string.IsNullOrWhiteSpace(_settings.ClientId))
        {
            _http.DefaultRequestHeaders.Remove("x-client-id");
            _http.DefaultRequestHeaders.Add("x-client-id", _settings.ClientId);
        }

        if (!string.IsNullOrWhiteSpace(_settings.ClientSecret))
        {
            _http.DefaultRequestHeaders.Remove("x-client-secret");
            _http.DefaultRequestHeaders.Add("x-client-secret", _settings.ClientSecret);
        }

        _http.DefaultRequestHeaders.Remove("x-api-version");
        _http.DefaultRequestHeaders.Add("x-api-version", _settings.ApiVersion);

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

    public string ClientId => _settings.Mode == PaymentMode.Live ? _settings.ClientId : string.Empty;

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

        // Cashfree order ids must be unique per attempt (not per order), because a customer can
        // retry a failed payment and Cashfree rejects a re-used order_id outright.
        var attemptId = $"{order.OrderNumber}-{DateTime.UtcNow:yyMMddHHmmss}";

        var payload = new Dictionary<string, object?>
        {
            ["order_id"] = attemptId,
            ["order_amount"] = decimal.Round(order.TotalAmount, 2, MidpointRounding.AwayFromZero),
            ["order_currency"] = "INR",
            ["order_note"] = $"Order {order.OrderNumber}",
            ["customer_details"] = new Dictionary<string, object?>
            {
                ["customer_id"] = SafeCustomerId(order.UserId),
                ["customer_name"] = Truncate(buyerName, 100),
                ["customer_email"] = email,
                ["customer_phone"] = DigitsOnly(phone)
            },
            ["order_meta"] = new Dictionary<string, object?>
            {
                ["return_url"] = $"{siteBase}/Checkout/PaymentCallback?order_id={{order_id}}",
                ["notify_url"] = $"{siteBase}/api/payment/webhook"
            }
        };

        try
        {
            var (ok, body) = await PostAsync("orders", payload, ct);

            if (!ok)
            {
                _logger.LogError("Cashfree create-order failed. Body {Body}", Truncate(body, 900));
                return new PaymentRequestResult(false, null, null, ExtractError(body)
                    ?? "The payment gateway rejected the request. Please try again.");
            }

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var sessionId = root.TryGetProperty("payment_session_id", out var sid) ? sid.GetString() : null;
            var cfOrderId = root.TryGetProperty("order_id", out var oid) ? oid.GetString() : attemptId;

            if (string.IsNullOrWhiteSpace(sessionId))
            {
                _logger.LogError("Cashfree order created without a payment_session_id: {Body}", Truncate(body, 900));
                return new PaymentRequestResult(false, null, null,
                    "The payment gateway could not create this payment.");
            }

            _logger.LogInformation("Cashfree order {Id} created for order {OrderNumber}",
                cfOrderId, order.OrderNumber);

            // PaymentUrl carries the session id; the checkout page hands it to Cashfree's JS SDK.
            return new PaymentRequestResult(true, cfOrderId, sessionId, null);
        }
        catch (TaskCanceledException)
        {
            _logger.LogError("Cashfree create-order timed out for order {OrderNumber}", order.OrderNumber);
            return new PaymentRequestResult(false, null, null,
                "The payment gateway did not respond in time. Please try again.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cashfree create-order threw for order {OrderNumber}", order.OrderNumber);
            return new PaymentRequestResult(false, null, null,
                "We could not reach the payment gateway. Please try again in a moment.");
        }
    }

    public async Task<PaymentStatusResult> GetPaymentStatusAsync(string cashfreeOrderId, CancellationToken ct = default)
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
            using var response = await _http.GetAsync($"orders/{Uri.EscapeDataString(cashfreeOrderId)}/payments", ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Cashfree status check failed for {Id}. Status {Status}",
                    cashfreeOrderId, response.StatusCode);
                return new PaymentStatusResult(false, TransactionStatus.Pending, null, null, 0,
                    "Could not verify the payment status.", Truncate(body, 3900));
            }

            using var doc = JsonDocument.Parse(body);
            var payments = doc.RootElement;

            // The endpoint returns an array of every attempt against this order; the successful
            // one (if any) decides the outcome, same as it did with the previous gateway.
            if (payments.ValueKind == JsonValueKind.Array && payments.GetArrayLength() > 0)
            {
                foreach (var payment in payments.EnumerateArray())
                {
                    var status = payment.TryGetProperty("payment_status", out var s) ? s.GetString() : null;

                    if (string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase))
                    {
                        decimal.TryParse(
                            payment.TryGetProperty("payment_amount", out var amt) ? amt.ToString() : "0",
                            NumberStyles.Any, CultureInfo.InvariantCulture, out var amount);

                        return new PaymentStatusResult(
                            true,
                            TransactionStatus.Success,
                            payment.TryGetProperty("cf_payment_id", out var pid) ? pid.ToString() : null,
                            payment.TryGetProperty("payment_group", out var pg) ? pg.GetString() : null,
                            amount,
                            null,
                            Truncate(body, 3900));
                    }
                }

                var first = payments[0];
                var firstStatus = first.TryGetProperty("payment_status", out var fs) ? fs.GetString() : null;

                decimal.TryParse(
                    first.TryGetProperty("payment_amount", out var famt) ? famt.ToString() : "0",
                    NumberStyles.Any, CultureInfo.InvariantCulture, out var firstAmount);

                // PENDING/user still on the checkout page — not a failure yet.
                if (string.Equals(firstStatus, "PENDING", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(firstStatus, "NOT_ATTEMPTED", StringComparison.OrdinalIgnoreCase))
                {
                    return new PaymentStatusResult(true, TransactionStatus.Pending, null, null, firstAmount,
                        null, Truncate(body, 3900));
                }

                return new PaymentStatusResult(
                    true,
                    TransactionStatus.Failed,
                    first.TryGetProperty("cf_payment_id", out var ffid) ? ffid.ToString() : null,
                    first.TryGetProperty("payment_group", out var fpg) ? fpg.GetString() : null,
                    firstAmount,
                    first.TryGetProperty("payment_message", out var fm) ? fm.GetString() : "Payment was not completed.",
                    Truncate(body, 3900));
            }

            // No attempts recorded yet: the customer has not reached the bank/UPI step.
            return new PaymentStatusResult(true, TransactionStatus.Pending, null, null, 0,
                null, Truncate(body, 3900));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cashfree status check threw for {Id}", cashfreeOrderId);
            return new PaymentStatusResult(false, TransactionStatus.Pending, null, null, 0,
                "Could not verify the payment status.", null);
        }
    }

    /// <summary>
    /// Cashfree signs webhooks as Base64(HMAC-SHA256(timestamp + rawBody, clientSecret)), delivered
    /// via the x-webhook-timestamp and x-webhook-signature headers. The raw, unparsed request body
    /// must be used — re-serialising JSON can reorder or re-format it and break the signature.
    /// </summary>
    public bool VerifyWebhookSignature(string rawBody, string timestamp, string receivedSignature)
    {
        if (string.IsNullOrWhiteSpace(_settings.ClientSecret) ||
            string.IsNullOrWhiteSpace(timestamp) ||
            string.IsNullOrWhiteSpace(receivedSignature))
        {
            return false;
        }

        try
        {
            var signedPayload = timestamp + rawBody;

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_settings.ClientSecret));
            var computed = Convert.ToBase64String(
                hmac.ComputeHash(Encoding.UTF8.GetBytes(signedPayload)));

            // Constant-time compare so a caller can't probe the signature byte by byte.
            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(computed),
                Encoding.UTF8.GetBytes(receivedSignature.Trim()));
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

        _logger.LogInformation(
            "Simulated payment request {RequestId} created for order {OrderNumber} ({Amount:C})",
            requestId, order.OrderNumber, order.TotalAmount);

        // The simulated flow never touches the real Cashfree SDK, so the "session id" is just a marker.
        return new PaymentRequestResult(true, requestId, requestId, null);
    }

    private async Task<(bool Ok, string Body)> PostAsync(
        string path, Dictionary<string, object?> payload, CancellationToken ct)
    {
        using var content = new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        using var response = await _http.PostAsync(path, content, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        return (response.IsSuccessStatusCode, body);
    }

    /// <summary>Cashfree requires an alphanumeric customer_id; the app user id (a GUID) already fits.</summary>
    private static string SafeCustomerId(string? userId) =>
        string.IsNullOrWhiteSpace(userId)
            ? "guest-" + Guid.NewGuid().ToString("N")[..12]
            : new string(userId.Where(char.IsLetterOrDigit).ToArray()) is { Length: > 0 } cleaned
                ? Truncate(cleaned, 50)
                : "guest-" + Guid.NewGuid().ToString("N")[..12];

    private static string DigitsOnly(string input)
    {
        var digits = new string(input.Where(char.IsDigit).ToArray());
        // Cashfree wants a bare 10-digit Indian number; strip a leading 91 or 0.
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
            // Cashfree error shape: { "message": "...", "code": "...", "type": "..." }
            if (doc.RootElement.TryGetProperty("message", out var msg) && msg.ValueKind == JsonValueKind.String)
                return msg.GetString();
        }
        catch
        {
            // Fall through to the caller's generic message.
        }

        return null;
    }
}
