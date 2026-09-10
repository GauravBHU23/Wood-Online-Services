using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;
using WoodOnlineService.ViewModels;

namespace WoodOnlineService.Controllers;

public class ShopController : BaseController
{
    private const int PageSize = 12;

    private readonly ApplicationDbContext _db;
    private readonly IReviewService _reviews;
    private readonly UserManager<ApplicationUser> _userManager;

    public ShopController(
        ApplicationDbContext db,
        IReviewService reviews,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _reviews = reviews;
        _userManager = userManager;
    }

    public async Task<IActionResult> Index(
        int? categoryId, string? search, string? woodType,
        decimal? minPrice, decimal? maxPrice, int? minRating,
        string sort = "newest", int page = 1)
    {
        if (page < 1) page = 1;

        var query = _db.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Where(p => p.IsAvailable)
            .AsQueryable();

        if (categoryId is > 0)
            query = query.Where(p => p.CategoryId == categoryId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Cap the term so an oversized string cannot be used to make the database work hard.
            var term = search.Trim();
            if (term.Length > 80) term = term[..80];

            query = query.Where(p =>
                p.Name.Contains(term) ||
                (p.Description != null && p.Description.Contains(term)) ||
                (p.WoodType != null && p.WoodType.Contains(term)) ||
                (p.Category != null && p.Category.Name.Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(woodType))
            query = query.Where(p => p.WoodType == woodType);

        // Custom-order items carry no price, so a price filter must not silently drop them.
        if (minPrice is > 0)
            query = query.Where(p => p.Price >= minPrice || p.IsCustomOrder);

        if (maxPrice is > 0)
            query = query.Where(p => p.Price <= maxPrice || p.IsCustomOrder);

        if (minRating is >= 1 and <= 5)
            query = query.Where(p => p.AverageRating >= minRating.Value);

        // Custom-order items carry no price, so they are pushed to the end of price sorts.
        var sqlite = _db.IsSqliteProvider();

        query = sort switch
        {
            "price-low" => query.OrderBy(p => p.IsCustomOrder).ThenByPrice(descending: false, sqlite),
            "price-high" => query.OrderBy(p => p.IsCustomOrder).ThenByPrice(descending: true, sqlite),
            "name" => query.OrderBy(p => p.Name),
            "rating" => query.OrderByRating(sqlite).ThenByDescending(p => p.ReviewCount),
            "popular" => query.OrderByDescending(p => p.ReviewCount).ThenByRating(sqlite),
            _ => query.OrderByDescending(p => p.IsFeatured).ThenByDescending(p => p.ProductId)
        };

        var total = await query.CountAsync();

        var model = new ShopViewModel
        {
            CategoryId = categoryId,
            Search = search,
            WoodType = woodType,
            MinPrice = minPrice,
            MaxPrice = maxPrice,
            MinRating = minRating,
            Sort = sort,
            Page = page,
            PageSize = PageSize,
            TotalCount = total,

            Products = await query.Skip((page - 1) * PageSize).Take(PageSize).ToListAsync(),

            Categories = await _db.Categories
                .AsNoTracking()
                .Where(c => c.IsActive)
                .OrderBy(c => c.DisplayOrder)
                .ToListAsync(),

            WoodTypes = await _db.Products
                .AsNoTracking()
                .Where(p => p.IsAvailable && p.WoodType != null && p.WoodType != "")
                .Select(p => p.WoodType!)
                .Distinct()
                .OrderBy(w => w)
                .ToListAsync()
        };

        if (categoryId is > 0)
            model.CategoryName = model.Categories.FirstOrDefault(c => c.CategoryId == categoryId)?.Name;

        ViewData["Title"] = model.CategoryName ?? "Products";
        ViewData["MetaDescription"] =
            $"{model.CategoryName ?? "Solid wood furniture"} - handcrafted from seasoned Sheesham, Teak and Mango wood.";

        return View(model);
    }

    public async Task<IActionResult> Details(int id, int reviewPage = 1)
    {
        var product = await _db.Products
            .Include(p => p.Category)
            .Include(p => p.Images.OrderBy(i => i.DisplayOrder))
            .FirstOrDefaultAsync(p => p.ProductId == id);

        if (product is null) return NotFound();

        var summary = await _reviews.GetSummaryAsync(id);

        var model = new ProductDetailViewModel
        {
            Product = product,
            Related = await _db.Products
                .AsNoTracking()
                .Where(p => p.CategoryId == product.CategoryId && p.ProductId != id && p.IsAvailable)
                .OrderByDescending(p => p.IsFeatured)
                .ThenByRating(_db.IsSqliteProvider())
                .Take(4)
                .ToListAsync(),

            InquiryForm = new InquiryFormModel
            {
                ProductId = product.ProductId,
                Message = $"I would like more information about \"{product.Name}\". "
            },

            ReviewSummary = summary,
            Reviews = await _reviews.GetApprovedAsync(id, reviewPage),
            ReviewPage = reviewPage,
            ReviewTotalPages = Math.Max(1, (int)Math.Ceiling(summary.TotalReviews / 10.0))
        };

        if (User.Identity?.IsAuthenticated == true)
        {
            var userId = _userManager.GetUserId(User);
            if (!string.IsNullOrEmpty(userId))
            {
                model.UserReview = await _reviews.GetUserReviewAsync(id, userId);
                model.UserHasPurchased = await _reviews.HasPurchasedAsync(id, userId);

                model.VotedReviewIds = await _db.ReviewVotes
                    .Where(v => v.UserId == userId)
                    .Select(v => v.ReviewId)
                    .ToListAsync();
            }
        }

        ViewData["Title"] = product.Name;
        ViewData["MetaDescription"] = product.Description?.Length > 160
            ? product.Description[..157] + "..."
            : product.Description;

        return View(model);
    }
}
