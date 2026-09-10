using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

/// <summary>
/// Safety net for missed webhooks.
///
/// A webhook can be lost for ordinary reasons: the app was asleep (the free App Service tier
/// idles out), it was restarting during a deploy, or the network dropped the callback. When
/// that happens the customer has paid but the order still says Pending, which is the worst
/// possible state to leave someone in.
///
/// This walks pending transactions and asks Instamojo what actually happened, so the order
/// self-corrects without anyone having to notice.
/// </summary>
public class PaymentReconciliationService : BackgroundService
{
    // Long enough that the webhook gets first chance, short enough that a customer
    // refreshing their orders page sees the truth quickly.
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    // Anything older than this was almost certainly abandoned at the gateway.
    private static readonly TimeSpan MaxAge = TimeSpan.FromHours(24);

    private readonly IServiceProvider _services;
    private readonly ILogger<PaymentReconciliationService> _logger;

    public PaymentReconciliationService(
        IServiceProvider services,
        ILogger<PaymentReconciliationService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the app finish starting before adding background work.
        await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReconcileAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // Never let a bad pass kill the loop; try again next interval.
                _logger.LogError(ex, "Payment reconciliation pass failed.");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    private async Task ReconcileAsync(CancellationToken ct)
    {
        using var scope = _services.CreateScope();

        var instamojo = scope.ServiceProvider.GetRequiredService<IInstamojoService>();

        // Nothing to reconcile when the gateway is off or simulated.
        if (!instamojo.IsUsable || instamojo.IsSimulated) return;

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var notify = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var cutoff = DateTime.UtcNow - MaxAge;

        var pending = await db.PaymentTransactions
            .Include(t => t.Order)
            .ThenInclude(o => o!.Items)
            .Where(t => t.Status == TransactionStatus.Pending
                        && t.PaymentRequestId != null
                        && t.CreatedDate >= cutoff)
            .OrderBy(t => t.CreatedDate)
            .Take(25)
            .ToListAsync(ct);

        if (pending.Count == 0) return;

        _logger.LogInformation("Reconciling {Count} pending payment(s).", pending.Count);

        foreach (var transaction in pending)
        {
            if (ct.IsCancellationRequested) break;
            if (transaction.Order is null) continue;

            var status = await instamojo.GetPaymentStatusAsync(transaction.PaymentRequestId!, ct);

            // A failed lookup means we could not reach Instamojo; leave it pending and retry later.
            if (!status.Success) continue;

            if (status.Status == TransactionStatus.Success)
            {
                await MarkPaidAsync(db, notify, transaction, status, ct);
            }
            else if (status.Status == TransactionStatus.Failed)
            {
                transaction.Status = TransactionStatus.Failed;
                transaction.FailureReason = status.FailureReason ?? "Payment was not completed.";
                transaction.CompletedDate = DateTime.UtcNow;
                transaction.Order.PaymentStatus = PaymentStatus.Failed;

                await db.SaveChangesAsync(ct);

                _logger.LogInformation("Reconciled {OrderNumber} as failed.", transaction.Order.OrderNumber);
            }
            // Still Pending at the gateway: the customer has not finished paying yet.
        }
    }

    private async Task MarkPaidAsync(
        ApplicationDbContext db,
        INotificationService notify,
        PaymentTransaction transaction,
        PaymentStatusResult status,
        CancellationToken ct)
    {
        var order = transaction.Order!;

        transaction.Status = TransactionStatus.Success;
        transaction.PaymentId = status.PaymentId;
        transaction.PaymentMethod = status.PaymentMethod;
        transaction.CompletedDate = DateTime.UtcNow;
        transaction.GatewayResponse = status.RawResponse;

        order.PaymentStatus = PaymentStatus.Paid;
        order.PaymentReference = status.PaymentId;

        // Only ever move the order forward.
        if (order.OrderStatus == OrderStatus.Pending)
            order.OrderStatus = OrderStatus.Confirmed;

        await db.SaveChangesAsync(ct);

        var email = await db.Users
            .Where(u => u.Id == order.UserId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync(ct);

        // The customer never got a confirmation when the webhook was missed, so send it now.
        await notify.NotifyOrderPlacedAsync(order, email);
        await notify.NotifyPaymentSuccessAsync(order, transaction, email);

        _logger.LogWarning(
            "Recovered a missed webhook: order {OrderNumber} marked paid by reconciliation.",
            order.OrderNumber);
    }
}
