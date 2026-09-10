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
    private readonly IInstamojoService _instamojo;
    private readonly INotificationService _notify;
    private readonly ILogger<PaymentApiController> _logger;

    public PaymentApiController(
        ApplicationDbContext db,
        IInstamojoService instamojo,
        INotificationService notify,
        ILogger<PaymentApiController> logger)
    {
        _db = db;
        _instamojo = instamojo;
        _notify = notify;
        _logger = logger;
    }

    /// <summary>
    /// Server-to-server callback from Instamojo. Anonymous by necessity — the gateway has no
    /// session — so authenticity rests entirely on the HMAC signature, which is verified before
    /// anything is written. Antiforgery is disabled here because the caller is not a browser.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("webhook")]
    public async Task<IActionResult> Webhook()
    {
        if (!Request.HasFormContentType)
        {
            _logger.LogWarning("Payment webhook rejected: unexpected content type {ContentType}",
                Request.ContentType);
            return BadRequest(new { success = false, message = "Invalid request." });
        }

        var form = Request.Form.ToDictionary(f => f.Key, f => f.Value.ToString());

        if (!form.TryGetValue("mac", out var mac) || string.IsNullOrWhiteSpace(mac))
        {
            _logger.LogWarning("Payment webhook rejected: signature missing.");
            return BadRequest(new { success = false, message = "Invalid request." });
        }

        if (!_instamojo.VerifyWebhookSignature(form, mac))
        {
            // Someone posted a forged callback. Log it and give nothing away.
            _logger.LogWarning("Payment webhook rejected: signature mismatch. Payment id {PaymentId}",
                form.GetValueOrDefault("payment_id"));
            return Unauthorized(new { success = false, message = "Invalid request." });
        }

        var paymentRequestId = form.GetValueOrDefault("payment_request_id");
        var paymentId = form.GetValueOrDefault("payment_id");
        var status = form.GetValueOrDefault("status");

        if (string.IsNullOrWhiteSpace(paymentRequestId))
            return BadRequest(new { success = false, message = "Invalid request." });

        var transaction = await _db.PaymentTransactions
            .Include(t => t.Order)
            .ThenInclude(o => o!.Items)
            .FirstOrDefaultAsync(t => t.PaymentRequestId == paymentRequestId);

        if (transaction?.Order is null)
        {
            _logger.LogWarning("Payment webhook for unknown request {RequestId}", paymentRequestId);
            return Ok(new { success = true }); // Acknowledge so Instamojo stops retrying.
        }

        // Instamojo retries webhooks; a settled transaction must not be processed twice.
        if (transaction.Status == TransactionStatus.Success)
        {
            _logger.LogInformation("Duplicate webhook ignored for {RequestId}", paymentRequestId);
            return Ok(new { success = true });
        }

        var order = transaction.Order;
        var succeeded = string.Equals(status, "Credit", StringComparison.OrdinalIgnoreCase);

        transaction.PaymentId = paymentId;
        transaction.IsWebhookVerified = true;
        transaction.PaymentMethod = form.GetValueOrDefault("instrument_type");
        transaction.CompletedDate = DateTime.UtcNow;
        transaction.GatewayResponse = Truncate(
            string.Join("&", form.Where(f => f.Key != "mac").Select(f => $"{f.Key}={f.Value}")), 4000);

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
            transaction.Status = TransactionStatus.Failed;
            transaction.FailureReason = Truncate(form.GetValueOrDefault("failure_reason")
                ?? form.GetValueOrDefault("status"), 500);

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
