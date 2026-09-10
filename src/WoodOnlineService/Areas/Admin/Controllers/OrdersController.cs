using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class OrdersController : AdminBaseController
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notify;
    private readonly IInvoiceService _invoices;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(
        ApplicationDbContext db,
        INotificationService notify,
        IInvoiceService invoices,
        ILogger<OrdersController> logger)
    {
        _db = db;
        _notify = notify;
        _invoices = invoices;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string? status, string? search, int page = 1)
    {
        if (page < 1) page = 1;

        var query = _db.Orders.Include(o => o.Items).AsQueryable();

        if (Enum.TryParse<OrderStatus>(status, out var parsed))
            query = query.Where(o => o.OrderStatus == parsed);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(o =>
                o.OrderNumber.Contains(term) ||
                o.ShippingName.Contains(term) ||
                o.ShippingPhone.Contains(term));
        }

        var total = await query.CountAsync();

        var model = new AdminListViewModel<Order>
        {
            Items = await query
                .OrderByDescending(o => o.OrderDate)
                .Skip((page - 1) * PageSize)
                .Take(PageSize)
                .ToListAsync(),
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            Search = search,
            Status = status
        };

        ViewBag.PendingCount = await _db.Orders.CountAsync(o => o.OrderStatus == OrderStatus.Pending);
        ViewBag.ConfirmedCount = await _db.Orders.CountAsync(o => o.OrderStatus == OrderStatus.Confirmed);
        ViewBag.ShippedCount = await _db.Orders.CountAsync(o => o.OrderStatus == OrderStatus.Shipped);

        ViewData["Title"] = "Orders";
        return View(model);
    }

    public async Task<IActionResult> Details(int id)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.OrderId == id);

        if (order is null) return NotFound();

        ViewData["Title"] = $"Order {order.OrderNumber}";
        return View(order);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateStatus(int id, OrderStatus orderStatus, PaymentStatus paymentStatus,
        string? trackingNumber, string? returnUrl)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.OrderId == id);

        if (order is null) return NotFound();

        var wasCancelled = order.OrderStatus == OrderStatus.Cancelled;
        var statusChanged = order.OrderStatus != orderStatus;

        order.OrderStatus = orderStatus;
        order.PaymentStatus = paymentStatus;
        order.TrackingNumber = string.IsNullOrWhiteSpace(trackingNumber) ? null : trackingNumber.Trim();

        if (orderStatus == OrderStatus.Shipped && order.ShippedDate is null)
            order.ShippedDate = DateTime.UtcNow;

        if (orderStatus == OrderStatus.Delivered)
        {
            order.DeliveredDate ??= DateTime.UtcNow;

            // A delivered COD order has been paid for by definition.
            if (order.PaymentMethod == PaymentMethod.CashOnDelivery && order.PaymentStatus == PaymentStatus.Pending)
                order.PaymentStatus = PaymentStatus.Paid;
        }

        // Stock moves only on the transition, so repeated saves don't double-count it.
        if (orderStatus == OrderStatus.Cancelled && !wasCancelled)
        {
            foreach (var item in order.Items)
            {
                var product = await _db.Products.FindAsync(item.ProductId);
                if (product is not null) product.StockQuantity += item.Quantity;
            }
        }
        else if (wasCancelled && orderStatus != OrderStatus.Cancelled)
        {
            foreach (var item in order.Items)
            {
                var product = await _db.Products.FindAsync(item.ProductId);
                if (product is not null) product.StockQuantity = Math.Max(0, product.StockQuantity - item.Quantity);
            }
        }

        await _db.SaveChangesAsync();

        if (statusChanged)
        {
            await _notify.NotifyOrderStatusAsync(order, order.User?.Email);
            _logger.LogInformation("Order {OrderNumber} status set to {Status} kiya", order.OrderNumber, orderStatus);
        }

        TempData["Success"] = $"Order {order.OrderNumber} has been updated.";

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction(nameof(Details), new { id });
    }

    public async Task<IActionResult> Invoice(int id)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.OrderId == id);

        if (order is null) return NotFound();

        var invoice = _invoices.Build(order);

        ViewData["Title"] = $"Invoice {invoice.InvoiceNumber}";
        return View(invoice);
    }
}
