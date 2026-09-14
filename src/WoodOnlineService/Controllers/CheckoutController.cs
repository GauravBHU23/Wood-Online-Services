using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers;

[Authorize]
public class CheckoutController : BaseController
{
    private readonly ApplicationDbContext _db;
    private readonly ICartService _cart;
    private readonly IOrderService _orders;
    private readonly ICashfreeService _cashfree;
    private readonly INotificationService _notify;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<CheckoutController> _logger;

    public CheckoutController(
        ApplicationDbContext db,
        ICartService cart,
        IOrderService orders,
        ICashfreeService cashfree,
        INotificationService notify,
        UserManager<ApplicationUser> userManager,
        ILogger<CheckoutController> logger)
    {
        _db = db;
        _cart = cart;
        _orders = orders;
        _cashfree = cashfree;
        _notify = notify;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<IActionResult> Index()
    {
        var cart = await _cart.GetCartAsync(HttpContext);
        if (cart.IsEmpty)
        {
            TempData["Error"] = "Your cart is empty.";
            return RedirectToAction("Index", "Cart");
        }

        var user = await _userManager.GetUserAsync(User);

        ViewData["Title"] = "Checkout";
        ViewBag.Cart = cart;

        // Live mode with a broken configuration must not advertise online payment, because
        // submitting it would only fail. IsUsable covers both "configured" and "actually works".
        ViewBag.OnlinePaymentAvailable = _cashfree.IsUsable;

        // Prefill from the saved profile so returning customers barely have to type.
        return View(new Order
        {
            ShippingName = user?.FullName ?? string.Empty,
            ShippingPhone = user?.PhoneNumber ?? string.Empty,
            ShippingAddress = user?.Address ?? string.Empty,
            ShippingCity = user?.City ?? string.Empty,
            ShippingState = user?.State ?? string.Empty,
            ShippingPinCode = user?.PinCode ?? string.Empty,
            PaymentMethod = PaymentMethod.CashOnDelivery
        });
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> PlaceOrder(Order model, bool saveAddress = false)
    {
        var cart = await _cart.GetCartAsync(HttpContext);
        if (cart.IsEmpty)
        {
            TempData["Error"] = "Your cart is empty.";
            return RedirectToAction("Index", "Cart");
        }

        // Server-assigned at placement time; the posted form has no say over these.
        ModelState.Remove(nameof(Order.OrderNumber));
        ModelState.Remove(nameof(Order.UserId));

        if (!ModelState.IsValid)
        {
            ViewData["Title"] = "Checkout";
            ViewBag.Cart = cart;
            ViewBag.OnlinePaymentAvailable = _cashfree.IsUsable;
            return View(nameof(Index), model);
        }

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        // Never let a client select online payment when the gateway cannot actually take it.
        if (model.PaymentMethod == PaymentMethod.Online && !_cashfree.IsUsable)
        {
            TempData["Error"] = "Online payment is unavailable right now. Please choose Cash on Delivery.";
            return RedirectToAction(nameof(Index));
        }

        if (saveAddress)
        {
            user.FullName = string.IsNullOrWhiteSpace(user.FullName) ? model.ShippingName.Trim() : user.FullName;
            user.PhoneNumber = model.ShippingPhone.Trim();
            user.Address = model.ShippingAddress.Trim();
            user.City = model.ShippingCity.Trim();
            user.State = model.ShippingState.Trim();
            user.PinCode = model.ShippingPinCode.Trim();
            await _userManager.UpdateAsync(user);
        }

        Order order;
        try
        {
            order = await _orders.PlaceOrderAsync(HttpContext, user.Id, model);
        }
        catch (InvalidOperationException ex)
        {
            TempData["Error"] = ex.Message;
            return RedirectToAction("Index", "Cart");
        }

        if (order.PaymentMethod == PaymentMethod.CashOnDelivery)
        {
            await _notify.NotifyOrderPlacedAsync(order, user.Email);
            _logger.LogInformation("COD order {OrderNumber} placed for {Total}", order.OrderNumber, order.TotalAmount);

            TempData["Success"] = "Your order has been placed successfully.";
            return RedirectToAction(nameof(Success), new { orderNumber = order.OrderNumber });
        }

        return await StartOnlinePaymentAsync(order, user);
    }

    private async Task<IActionResult> StartOnlinePaymentAsync(Order order, ApplicationUser user)
    {
        var transaction = new PaymentTransaction
        {
            OrderId = order.OrderId,
            Amount = order.TotalAmount,
            Status = TransactionStatus.Created
        };

        _db.PaymentTransactions.Add(transaction);
        await _db.SaveChangesAsync();

        var result = await _cashfree.CreatePaymentRequestAsync(
            order,
            order.ShippingName,
            user.Email ?? string.Empty,
            order.ShippingPhone);

        if (!result.Success || string.IsNullOrWhiteSpace(result.PaymentUrl))
        {
            transaction.Status = TransactionStatus.Failed;
            transaction.FailureReason = result.ErrorMessage;
            order.PaymentStatus = PaymentStatus.Failed;
            await _db.SaveChangesAsync();

            _logger.LogError("Could not start payment for {OrderNumber}: {Error}",
                order.OrderNumber, result.ErrorMessage);

            // The order exists with stock already reserved, so send them somewhere they can retry.
            TempData["Error"] = result.ErrorMessage
                ?? "We could not start the payment. Your order is saved — you can retry payment from your orders page.";

            return RedirectToAction("Details", "Orders", new { id = order.OrderId });
        }

        transaction.PaymentRequestId = result.PaymentRequestId;
        transaction.PaymentUrl = result.PaymentUrl;
        transaction.Status = TransactionStatus.Pending;
        await _db.SaveChangesAsync();

        if (_cashfree.IsSimulated)
        {
            _logger.LogInformation("Redirecting order {OrderNumber} to the simulated gateway", order.OrderNumber);
            return RedirectToAction(nameof(SimulatedGateway), new { requestId = result.PaymentRequestId });
        }

        // Cashfree's hosted checkout is launched by its JS SDK, not a plain HTTP redirect, so the
        // customer is handed to a thin page that opens it with this payment_session_id.
        _logger.LogInformation("Handing order {OrderNumber} to Cashfree checkout", order.OrderNumber);

        ViewData["Title"] = "Redirecting to Payment";
        ViewBag.PaymentSessionId = result.PaymentUrl;
        ViewBag.ClientId = _cashfree.ClientId;
        return View("GatewayRedirect");
    }

    /// <summary>
    /// Stand-in for the Cashfree checkout page, used only when payments run in Simulated mode.
    /// It lets the whole flow be exercised locally, where the real gateway cannot reach back.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> SimulatedGateway(string requestId)
    {
        if (!_cashfree.IsSimulated) return NotFound();

        var userId = _userManager.GetUserId(User);

        var transaction = await _db.PaymentTransactions
            .Include(t => t.Order)
            .FirstOrDefaultAsync(t => t.PaymentRequestId == requestId);

        // Scoped to the signed-in customer so nobody can drive someone else's payment.
        if (transaction?.Order is null || transaction.Order.UserId != userId)
        {
            TempData["Error"] = "We could not find that payment.";
            return RedirectToAction("Index", "Orders");
        }

        if (transaction.Status == TransactionStatus.Success)
            return RedirectToAction(nameof(Success), new { orderNumber = transaction.Order.OrderNumber });

        ViewData["Title"] = "Complete Payment";
        ViewBag.Order = transaction.Order;
        return View(transaction);
    }

    /// <summary>Applies the outcome the customer chose on the simulated gateway page.</summary>
    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> SimulatedGateway(string requestId, string outcome, string? method)
    {
        if (!_cashfree.IsSimulated) return NotFound();

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        var transaction = await _db.PaymentTransactions
            .Include(t => t.Order)
            .ThenInclude(o => o!.Items)
            .FirstOrDefaultAsync(t => t.PaymentRequestId == requestId);

        if (transaction?.Order is null || transaction.Order.UserId != user.Id)
        {
            TempData["Error"] = "We could not find that payment.";
            return RedirectToAction("Index", "Orders");
        }

        var order = transaction.Order;

        // A settled transaction must not be reopened by re-posting this form.
        if (transaction.Status == TransactionStatus.Success)
            return RedirectToAction(nameof(Success), new { orderNumber = order.OrderNumber });

        var succeeded = string.Equals(outcome, "success", StringComparison.OrdinalIgnoreCase);

        transaction.PaymentMethod = string.IsNullOrWhiteSpace(method) ? "UPI (simulated)" : method + " (simulated)";
        transaction.CompletedDate = DateTime.UtcNow;
        transaction.IsWebhookVerified = true;
        transaction.GatewayResponse = "Simulated payment, outcome chosen by the customer.";

        if (succeeded)
        {
            transaction.Status = TransactionStatus.Success;
            transaction.PaymentId = "SIMPAY-" + Guid.NewGuid().ToString("N")[..12].ToUpperInvariant();

            order.PaymentStatus = PaymentStatus.Paid;
            order.PaymentReference = transaction.PaymentId;
            if (order.OrderStatus == OrderStatus.Pending) order.OrderStatus = OrderStatus.Confirmed;

            await _db.SaveChangesAsync();

            await _notify.NotifyOrderPlacedAsync(order, user.Email);
            await _notify.NotifyPaymentSuccessAsync(order, transaction, user.Email);

            _logger.LogInformation("Simulated payment succeeded for {OrderNumber}", order.OrderNumber);

            TempData["Success"] = "Payment successful. Thank you!";
            return RedirectToAction(nameof(Success), new { orderNumber = order.OrderNumber });
        }

        transaction.Status = TransactionStatus.Failed;
        transaction.FailureReason = "Payment cancelled on the gateway.";
        order.PaymentStatus = PaymentStatus.Failed;

        await _db.SaveChangesAsync();
        await _notify.NotifyPaymentFailedAsync(order, transaction, user.Email);

        _logger.LogWarning("Simulated payment failed for {OrderNumber}", order.OrderNumber);

        TempData["Error"] = "Your payment was not completed. No amount has been charged. You can retry from your order page.";
        return RedirectToAction("Details", "Orders", new { id = order.OrderId });
    }

    /// <summary>
    /// Where Cashfree sends the customer's browser after payment. This is only a hint —
    /// the webhook is the authority. We verify with the API before trusting anything here,
    /// because these query values arrive through the customer's own browser.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> PaymentCallback([FromQuery] string? order_id)
    {
        var userId = _userManager.GetUserId(User);

        if (string.IsNullOrWhiteSpace(order_id))
        {
            TempData["Error"] = "We could not identify that payment.";
            return RedirectToAction("Index", "Orders");
        }

        var transaction = await _db.PaymentTransactions
            .Include(t => t.Order)
            .ThenInclude(o => o!.Items)
            .FirstOrDefaultAsync(t => t.PaymentRequestId == order_id);

        if (transaction?.Order is null || transaction.Order.UserId != userId)
        {
            TempData["Error"] = "We could not find that order.";
            return RedirectToAction("Index", "Orders");
        }

        var order = transaction.Order;

        // The webhook may already have settled this; if so just show the result.
        if (transaction.Status == TransactionStatus.Success)
            return RedirectToAction(nameof(Success), new { orderNumber = order.OrderNumber });

        // Ask Cashfree directly rather than trusting the query string.
        var status = await _cashfree.GetPaymentStatusAsync(order_id);

        if (status.Success && status.Status == TransactionStatus.Success)
        {
            transaction.Status = TransactionStatus.Success;
            transaction.PaymentId = status.PaymentId;
            transaction.PaymentMethod = status.PaymentMethod;
            transaction.CompletedDate = DateTime.UtcNow;
            transaction.GatewayResponse = status.RawResponse;

            order.PaymentStatus = PaymentStatus.Paid;
            order.PaymentReference = transaction.PaymentId;
            if (order.OrderStatus == OrderStatus.Pending) order.OrderStatus = OrderStatus.Confirmed;

            await _db.SaveChangesAsync();

            var user = await _userManager.GetUserAsync(User);
            await _notify.NotifyOrderPlacedAsync(order, user?.Email);
            await _notify.NotifyPaymentSuccessAsync(order, transaction, user?.Email);

            _logger.LogInformation("Payment verified on callback for {OrderNumber}", order.OrderNumber);

            TempData["Success"] = "Payment successful. Thank you!";
            return RedirectToAction(nameof(Success), new { orderNumber = order.OrderNumber });
        }

        if (status.Success && status.Status == TransactionStatus.Pending)
        {
            // Some UPI apps confirm minutes later; the order page polls for the webhook.
            TempData["Error"] = "Your payment is still being confirmed. This page will update automatically.";
            return RedirectToAction("Details", "Orders", new { id = order.OrderId, awaiting = true });
        }

        transaction.Status = TransactionStatus.Failed;
        transaction.FailureReason = status.FailureReason ?? "Payment was not completed.";
        transaction.CompletedDate = DateTime.UtcNow;
        order.PaymentStatus = PaymentStatus.Failed;
        await _db.SaveChangesAsync();

        var customer = await _userManager.GetUserAsync(User);
        await _notify.NotifyPaymentFailedAsync(order, transaction, customer?.Email);

        _logger.LogWarning("Payment failed on callback for {OrderNumber}: {Reason}",
            order.OrderNumber, transaction.FailureReason);

        TempData["Error"] = "Your payment could not be completed. No amount has been charged. You can retry from your order page.";
        return RedirectToAction("Details", "Orders", new { id = order.OrderId });
    }

    /// <summary>Lets a customer retry payment on an order that is saved but unpaid.</summary>
    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> RetryPayment(int orderId)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.OrderId == orderId && o.UserId == user.Id);

        if (order is null)
        {
            TempData["Error"] = "We could not find that order.";
            return RedirectToAction("Index", "Orders");
        }

        if (order.PaymentStatus == PaymentStatus.Paid)
        {
            TempData["Error"] = "This order is already paid.";
            return RedirectToAction("Details", "Orders", new { id = orderId });
        }

        if (order.OrderStatus == OrderStatus.Cancelled)
        {
            TempData["Error"] = "This order has been cancelled and cannot be paid.";
            return RedirectToAction("Details", "Orders", new { id = orderId });
        }

        if (!_cashfree.IsUsable)
        {
            TempData["Error"] = "Online payment is unavailable right now. Please contact us to complete this order.";
            return RedirectToAction("Details", "Orders", new { id = orderId });
        }

        return await StartOnlinePaymentAsync(order, user);
    }

    public async Task<IActionResult> Success(string orderNumber)
    {
        var userId = _userManager.GetUserId(User);

        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.OrderNumber == orderNumber && o.UserId == userId);

        if (order is null) return NotFound();

        ViewData["Title"] = "Order Confirmed";
        return View(order);
    }
}
