using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class DashboardController : AdminBaseController
{
    private readonly ApplicationDbContext _db;

    public DashboardController(ApplicationDbContext db) => _db = db;

    public async Task<IActionResult> Index()
    {
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);

        // SQLite can't SUM a decimal column, so totals are aggregated in memory.
        // Cancelled orders never became money, so they stay out of both figures.
        var revenueRows = await _db.Orders
            .Where(o => o.OrderStatus != OrderStatus.Cancelled)
            .Select(o => new { o.OrderDate, o.TotalAmount })
            .ToListAsync();

        var model = new DashboardViewModel
        {
            TotalProducts = await _db.Products.CountAsync(),
            OutOfStockCount = await _db.Products.CountAsync(p => !p.IsCustomOrder && p.StockQuantity <= 0),
            TotalCategories = await _db.Categories.CountAsync(),

            NewInquiries = await _db.Inquiries.CountAsync(i => i.Status == InquiryStatus.New),
            TotalInquiries = await _db.Inquiries.CountAsync(),

            PendingOrders = await _db.Orders.CountAsync(o => o.OrderStatus == OrderStatus.Pending),
            TotalOrders = await _db.Orders.CountAsync(),

            TotalRevenue = revenueRows.Sum(o => o.TotalAmount),

            RevenueLast30Days = revenueRows
                .Where(o => o.OrderDate >= thirtyDaysAgo)
                .Sum(o => o.TotalAmount),

            TotalCustomers = await _db.Users.CountAsync(),

            RecentOrders = await _db.Orders
                .Include(o => o.Items)
                .OrderByDescending(o => o.OrderDate)
                .Take(8)
                .ToListAsync(),

            RecentInquiries = await _db.Inquiries
                .Include(i => i.Product)
                .OrderByDescending(i => i.CreatedDate)
                .Take(8)
                .ToListAsync(),

            LowStockProducts = await _db.Products
                .Include(p => p.Category)
                .Where(p => !p.IsCustomOrder && p.StockQuantity <= 3)
                .OrderBy(p => p.StockQuantity)
                .Take(8)
                .ToListAsync()
        };

        ViewData["Title"] = "Dashboard";
        return View(model);
    }
}
