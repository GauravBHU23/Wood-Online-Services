using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers.Api;

[ApiController]
[Route("api/payment")]
public class PaymentApiController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICashfreeService _cashfree;
    private readonly INotificationService _notify;
    private readonly ILogger<PaymentApiController> _logger;

    public PaymentApiController(
        ApplicationDbContext db,
        ICashfreeService cashfree,
        INotificationService notify,
        ILogger<PaymentApiController> logger)
    {
        _db = db;
        _cashfree = cashfree;
        _notify = notify;
        _logger = logger;
    }

    /// <summary>
    /// Server-to-server callback from Cashfree. Anonymous by necessity — the gateway has no
    /// session — so authenticity rests entirely on the HMAC signature, which is verified before
    /// anything is written. Antiforgery is disabled here because the caller is not a browser.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("webhook")]
    public async Task<IActionResult> Webhook()
    {
        // The exact raw bytes are required: the signature is computed over them verbatim, and
        // re-serialising parsed JSON can reorder keys or change formatting and break the check.
        Request.EnableBuffering();
        string rawBody;
        using (var reader = new StreamReader(Request.Body, leaveOpen: true))
        {
            rawBody = await reader.ReadToEndAsync();
        }
        Request.Body.Position = 0;

        var timestamp = Request.Headers["x-webhook-timestamp"].ToString();
        var signature = Request.Headers["x-webhook-signature"].ToString();

        if (string.IsNullOrWhiteSpace(timestamp) || string.IsNullOrWhiteSpace(signature))
        {
            _logger.LogWarning("Payment webhook rejected: signature headers missing.");
            return BadRequest(new { success = false, message = "Invalid request." });
        }

        // A correctly-signed payload is valid forever unless we also check its age, which would
        // let a captured request (e.g. from a compromised log) be replayed at any later time.
        // Cashfree sends the timestamp as Unix epoch milliseconds.
        if (!long.TryParse(timestamp, out var epochMs))
        {
            _logger.LogWarning("Payment webhook rejected: malformed timestamp.");
            return BadRequest(new { success = false, message = "Invalid request." });
        }

        var sentAt = DateTimeOffset.FromUnixTimeMilliseconds(epochMs);
        var age = DateTimeOffset.UtcNow - sentAt;
        if (age > TimeSpan.FromMinutes(5) || age < TimeSpan.FromMinutes(-5))
        {
            _logger.LogWarning("Payment webhook rejected: timestamp outside freshness window ({Age}).", age);
            return BadRequest(new { success = false, message = "Invalid request." });
        }

        if (!_cashfree.VerifyWebhookSignature(rawBody, timestamp, signature))
        {
            // Someone posted a forged callback. Log it and give nothing away.
            _logger.LogWarning("Payment webhook rejected: signature mismatch.");
            return Unauthorized(new { success = false, message = "Invalid request." });
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(rawBody);
        }
        catch (JsonException)
        {
            _logger.LogWarning("Payment webhook rejected: malformed JSON.");
            return BadRequest(new { success = false, message = "Invalid request." });
        }

        using (doc)
        {
            var root = doc.RootElement;
            var eventType = root.TryGetProperty("type", out var t) ? t.GetString() : null;

            if (!root.TryGetProperty("data", out var data))
                return Ok(new { success = true });

            var cashfreeOrderId = data.TryGetProperty("order", out var orderEl) &&
                                   orderEl.TryGetProperty("order_id", out var oid)
                ? oid.GetString()
                : null;

            if (string.IsNullOrWhiteSpace(cashfreeOrderId))
                return Ok(new { success = true });

            var transaction = await _db.PaymentTransactions
                .Include(tr => tr.Order)
                .ThenInclude(o => o!.Items)
                .FirstOrDefaultAsync(tr => tr.PaymentRequestId == cashfreeOrderId);

            if (transaction?.Order is null)
            {
                _logger.LogWarning("Payment webhook for unknown order {OrderId}", cashfreeOrderId);
                return Ok(new { success = true }); // Acknowledge so Cashfree stops retrying.
            }

            // Cashfree retries webhooks; a settled transaction must not be processed twice.
            if (transaction.Status == TransactionStatus.Success)
            {
                _logger.LogInformation("Duplicate webhook ignored for {OrderId}", cashfreeOrderId);
                return Ok(new { success = true });
            }

            var order = transaction.Order;
            var paymentEl = data.TryGetProperty("payment", out var p) ? p : default;

            var paymentId = paymentEl.ValueKind == JsonValueKind.Object &&
                             paymentEl.TryGetProperty("cf_payment_id", out var pid)
                ? pid.ToString()
                : null;

            var paymentMethod = paymentEl.ValueKind == JsonValueKind.Object &&
                                 paymentEl.TryGetProperty("payment_group", out var pg)
                ? pg.GetString()
                : null;

            var succeeded = string.Equals(eventType, "PAYMENT_SUCCESS_WEBHOOK", StringComparison.OrdinalIgnoreCase);
            var failed = string.Equals(eventType, "PAYMENT_FAILED_WEBHOOK", StringComparison.OrdinalIgnoreCase) ||
                         string.Equals(eventType, "PAYMENT_USER_DROPPED_WEBHOOK", StringComparison.OrdinalIgnoreCase);

            if (!succeeded && !failed)
            {
                // Other event types (refunds, disputes) are outside this order's payment flow.
                return Ok(new { success = true });
            }

            transaction.PaymentId = paymentId;
            transaction.IsWebhookVerified = true;
            transaction.PaymentMethod = paymentMethod;
            transaction.CompletedDate = DateTime.UtcNow;
            transaction.GatewayResponse = Truncate(rawBody, 4000);

            if (succeeded)
            {
                transaction.Status = TransactionStatus.Success;
                order.PaymentStatus = PaymentStatus.Paid;
                order.PaymentReference = paymentId;

                // Only advance the order; never walk an already-shipped order backwards.
                if (order.OrderStatus == OrderStatus.Pending)
                    order.OrderStatus = OrderStatus.Confirmed;

                await _db.SaveChangesAsync();

                var email = await _db.Users
                    .Where(u => u.Id == order.UserId)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();

                await _notify.NotifyPaymentSuccessAsync(order, transaction, email);

                _logger.LogInformation("Payment confirmed for order {OrderNumber}, payment {PaymentId}",
                    order.OrderNumber, paymentId);
            }
            else
            {
                var errorMessage = data.TryGetProperty("error_details", out var err) &&
                                    err.TryGetProperty("error_description", out var desc)
                    ? desc.GetString()
                    : paymentEl.ValueKind == JsonValueKind.Object &&
                      paymentEl.TryGetProperty("payment_message", out var msg)
                        ? msg.GetString()
                        : "Payment was not completed.";

                transaction.Status = TransactionStatus.Failed;
                transaction.FailureReason = Truncate(errorMessage, 500);

                order.PaymentStatus = PaymentStatus.Failed;

                await _db.SaveChangesAsync();

                var email = await _db.Users
                    .Where(u => u.Id == order.UserId)
                    .Select(u => u.Email)
                    .FirstOrDefaultAsync();

                await _notify.NotifyPaymentFailedAsync(order, transaction, email);

                _logger.LogWarning("Payment failed for order {OrderNumber}: {Reason}",
                    order.OrderNumber, transaction.FailureReason);
            }
        }

        return Ok(new { success = true });
    }

    /// <summary>Lets the customer's own order page poll while a payment settles.</summary>
    [HttpGet("status/{orderId:int}")]
    [Authorize]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> Status(int orderId)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        // Scoped by user so one customer cannot poll another's order.
        var order = await _db.Orders
            .AsNoTracking()
            .Where(o => o.OrderId == orderId && o.UserId == userId)
            .Select(o => new { o.OrderNumber, o.PaymentStatus, o.OrderStatus, o.TotalAmount })
            .FirstOrDefaultAsync();

        if (order is null) return NotFound(new { success = false, message = "Order not found." });

        return Ok(new
        {
            success = true,
            orderNumber = order.OrderNumber,
            paymentStatus = order.PaymentStatus.ToString(),
            orderStatus = order.OrderStatus.ToString(),
            amount = order.TotalAmount,
            isPaid = order.PaymentStatus == PaymentStatus.Paid
        });
    }

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? null : value.Length <= max ? value : value[..max];
}
