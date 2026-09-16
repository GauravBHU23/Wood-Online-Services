using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Areas.Admin.Controllers;

/// <summary>
/// The customer directory: every registered account, how much they've ordered, and a block/
/// unblock switch. "Blocked" reuses Identity's own LockoutEnd — set far in the future it stops
/// sign-in exactly like a lockout does, so no separate flag or sign-in check is needed anywhere else.
/// </summary>
public class UsersController : AdminBaseController
{
    private const int PageSize = 25;

    // Effectively forever, without literally being DateTimeOffset.MaxValue (which some
    // datetime columns / query providers handle awkwardly at the boundary).
    private static readonly DateTimeOffset BlockedUntil = DateTimeOffset.UtcNow.AddYears(100);

    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<UsersController> _logger;

    public UsersController(ApplicationDbContext db, UserManager<ApplicationUser> userManager, ILogger<UsersController> logger)
    {
        _db = db;
        _userManager = userManager;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string? search, string? filter, int page = 1)
    {
        if (page < 1) page = 1;

        var adminIds = await _db.UserRoles
            .Where(ur => ur.RoleId == _db.Roles.Where(r => r.Name == Roles.Admin).Select(r => r.Id).FirstOrDefault())
            .Select(ur => ur.UserId)
            .ToListAsync();

        var query = _db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u =>
                u.FullName.Contains(term) ||
                (u.Email != null && u.Email.Contains(term)) ||
                (u.PhoneNumber != null && u.PhoneNumber.Contains(term)));
        }

        var total = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.CreatedDate)
            .Skip((page - 1) * PageSize)
            .Take(PageSize)
            .ToListAsync();

        // Order totals pulled in one pass rather than per-row, so this page doesn't run a query
        // per customer.
        var userIds = users.Select(u => u.Id).ToList();
        var orderStats = await _db.Orders
            .Where(o => userIds.Contains(o.UserId) && o.OrderStatus != OrderStatus.Cancelled)
            .GroupBy(o => o.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count(), Items = g.ToList() })
            .ToListAsync();

        var items = users.Select(u =>
        {
            var stats = orderStats.FirstOrDefault(s => s.UserId == u.Id);
            return new UserListItem
            {
                UserId = u.Id,
                FullName = u.FullName,
                Email = u.Email ?? string.Empty,
                PhoneNumber = u.PhoneNumber,
                City = u.City,
                State = u.State,
                CreatedDate = u.CreatedDate,
                IsAdmin = adminIds.Contains(u.Id),
                IsBlocked = u.LockoutEnd is not null && u.LockoutEnd > DateTimeOffset.UtcNow,
                LockoutEnd = u.LockoutEnd,
                OrderCount = stats?.Count ?? 0,
                // Summed in memory: SQLite (used in development) cannot SUM a decimal column.
                TotalSpend = stats?.Items.Sum(o => o.TotalAmount) ?? 0m
            };
        }).ToList();

        if (string.Equals(filter, "blocked", StringComparison.OrdinalIgnoreCase))
            items = items.Where(i => i.IsBlocked).ToList();

        var model = new AdminListViewModel<UserListItem>
        {
            Items = items,
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            Search = search,
            Status = filter
        };

        // Comparing a DateTimeOffset column against DateTimeOffset.UtcNow isn't translatable on
        // SQLite (used in development) — the LockoutEnd values are pulled and compared in memory
        // instead, same as the per-row IsBlocked flags built above.
        var lockoutEnds = await _db.Users
            .Where(u => u.LockoutEnd != null)
            .Select(u => u.LockoutEnd)
            .ToListAsync();
        ViewBag.BlockedCount = lockoutEnds.Count(le => le > DateTimeOffset.UtcNow);
        ViewBag.TotalCustomers = total;

        ViewData["Title"] = "Customers";
        return View(model);
    }

    [HttpGet]
    public async Task<IActionResult> Details(string id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null) return NotFound();

        var orders = await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.UserId == id)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();

        ViewBag.IsAdmin = await _userManager.IsInRoleAsync(user, Roles.Admin);
        ViewBag.IsBlocked = user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow;

        ViewData["Title"] = user.FullName;
        ViewBag.Orders = orders;
        return View(user);
    }

    [HttpPost]
    public async Task<IActionResult> Block(string id, string? returnUrl)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        if (await _userManager.IsInRoleAsync(user, Roles.Admin))
        {
            TempData["Error"] = "Admin accounts cannot be blocked from here.";
            return RedirectBack(returnUrl);
        }

        await _userManager.SetLockoutEnabledAsync(user, true);
        await _userManager.SetLockoutEndDateAsync(user, BlockedUntil);

        // A blocked account's other devices must not stay signed in.
        user.CurrentSessionId = Guid.NewGuid().ToString("N");
        await _userManager.UpdateAsync(user);

        _logger.LogWarning("Customer {UserId} blocked by admin.", id);

        TempData["Success"] = $"{user.FullName} has been blocked.";
        return RedirectBack(returnUrl);
    }

    [HttpPost]
    public async Task<IActionResult> Unblock(string id, string? returnUrl)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        await _userManager.SetLockoutEndDateAsync(user, null);

        _logger.LogInformation("Customer {UserId} unblocked by admin.", id);

        TempData["Success"] = $"{user.FullName} has been unblocked.";
        return RedirectBack(returnUrl);
    }

    private IActionResult RedirectBack(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)
            ? Redirect(returnUrl)
            : RedirectToAction(nameof(Index));
}
