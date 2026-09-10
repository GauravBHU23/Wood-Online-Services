using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class ReviewsController : AdminBaseController
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _db;
    private readonly IReviewService _reviews;
    private readonly ILogger<ReviewsController> _logger;

    public ReviewsController(ApplicationDbContext db, IReviewService reviews, ILogger<ReviewsController> logger)
    {
        _db = db;
        _reviews = reviews;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string? status, string? search, int page = 1)
    {
        if (page < 1) page = 1;

        var query = _db.Reviews
            .Include(r => r.Product)
            .AsQueryable();

        if (Enum.TryParse<ReviewStatus>(status, out var parsed))
            query = query.Where(r => r.Status == parsed);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(r =>
                r.AuthorName.Contains(term) ||
                r.Comment.Contains(term) ||
                (r.Product != null && r.Product.Name.Contains(term)));
        }

        var total = await query.CountAsync();

        var model = new AdminListViewModel<Review>
        {
            Items = await query
                .OrderBy(r => r.Status)          // Pending first, so moderation is the default view.
                .ThenByDescending(r => r.CreatedDate)
                .Skip((page - 1) * PageSize)
                .Take(PageSize)
                .ToListAsync(),
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            Search = search,
            Status = status
        };

        ViewBag.PendingCount = await _db.Reviews.CountAsync(r => r.Status == ReviewStatus.Pending);
        ViewBag.ApprovedCount = await _db.Reviews.CountAsync(r => r.Status == ReviewStatus.Approved);
        ViewBag.RejectedCount = await _db.Reviews.CountAsync(r => r.Status == ReviewStatus.Rejected);

        ViewData["Title"] = "Reviews";
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> UpdateStatus(int id, ReviewStatus status, string? adminResponse, string? returnUrl)
    {
        var review = await _db.Reviews.FindAsync(id);
        if (review is null) return NotFound();

        review.Status = status;
        review.ModeratedDate = DateTime.UtcNow;

        if (adminResponse is not null)
            review.AdminResponse = string.IsNullOrWhiteSpace(adminResponse) ? null : adminResponse.Trim();

        await _db.SaveChangesAsync();

        // The product's cached average only counts approved reviews, so refresh it.
        await _reviews.RecalculateProductRatingAsync(review.ProductId);

        _logger.LogInformation("Review {ReviewId} set to {Status}", id, status);

        TempData["Success"] = $"Review has been {status.ToString().ToLowerInvariant()}.";

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    public async Task<IActionResult> Delete(int id)
    {
        var review = await _db.Reviews.FindAsync(id);
        if (review is null) return NotFound();

        var productId = review.ProductId;

        _db.Reviews.Remove(review);
        await _db.SaveChangesAsync();
        await _reviews.RecalculateProductRatingAsync(productId);

        _logger.LogInformation("Review {ReviewId} deleted", id);

        TempData["Success"] = "Review deleted.";
        return RedirectToAction(nameof(Index));
    }
}
