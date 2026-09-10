using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers;

[Authorize]
public class OrdersController : BaseController
{
    private readonly ApplicationDbContext _db;
    private readonly IInvoiceService _invoices;
    private readonly UserManager<ApplicationUser> _userManager;

    public OrdersController(
        ApplicationDbContext db,
        IInvoiceService invoices,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _invoices = invoices;
        _userManager = userManager;
    }

    /// <summary>The customer's own copy of the bill, scoped so nobody can print another's.</summary>
    public async Task<IActionResult> Invoice(int id)
    {
        var userId = _userManager.GetUserId(User);

        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.OrderId == id && o.UserId == userId);

        if (order is null) return NotFound();

        var invoice = _invoices.Build(order);

        ViewData["Title"] = $"Invoice {invoice.InvoiceNumber}";
        return View(invoice);
    }

    public async Task<IActionResult> Index()
    {
        var userId = _userManager.GetUserId(User);

        var orders = await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();

        ViewData["Title"] = "My Orders";
        return View(orders);
    }

    public async Task<IActionResult> Details(int id)
    {
        var userId = _userManager.GetUserId(User);

        // Scoped by user id so one customer can never read another's order by guessing the id.
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.OrderId == id && o.UserId == userId);

        if (order is null) return NotFound();

        ViewData["Title"] = $"Order {order.OrderNumber}";
        return View(order);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Cancel(int id)
    {
        var userId = _userManager.GetUserId(User);

        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.OrderId == id && o.UserId == userId);

        if (order is null) return NotFound();

        // Once it ships, cancelling is a phone conversation, not a button.
        if (order.OrderStatus is not (OrderStatus.Pending or OrderStatus.Confirmed))
        {
            TempData["Error"] = "This order can no longer be cancelled. Please contact us.";
            return RedirectToAction(nameof(Details), new { id });
        }

        order.OrderStatus = OrderStatus.Cancelled;

        foreach (var item in order.Items)
        {
            var product = await _db.Products.FindAsync(item.ProductId);
            if (product is not null)
                product.StockQuantity += item.Quantity;
        }

        await _db.SaveChangesAsync();

        TempData["Success"] = $"Order {order.OrderNumber} has been cancelled.";
        return RedirectToAction(nameof(Details), new { id });
    }
}
