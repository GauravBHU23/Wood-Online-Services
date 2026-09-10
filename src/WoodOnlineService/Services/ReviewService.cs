using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public record RatingBreakdown(int Stars, int Count, double Percentage);

public record ReviewSummary(
    decimal AverageRating,
    int TotalReviews,
    List<RatingBreakdown> Breakdown);

public record ReviewSubmitResult(bool Success, string Message, bool RequiresModeration);

public interface IReviewService
{
    Task<ReviewSubmitResult> SubmitAsync(int productId, string userId, int rating, string? title, string comment);
    Task<List<Review>> GetApprovedAsync(int productId, int page = 1, int pageSize = 10);
    Task<int> GetApprovedCountAsync(int productId);
    Task<ReviewSummary> GetSummaryAsync(int productId);
    Task<Review?> GetUserReviewAsync(int productId, string userId);
    Task<bool> HasPurchasedAsync(int productId, string userId);
    Task<bool> ToggleHelpfulAsync(int reviewId, string userId);
    Task RecalculateProductRatingAsync(int productId);
}

public class ReviewService : IReviewService
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notify;
    private readonly FeatureSettings _features;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(
        ApplicationDbContext db,
        INotificationService notify,
        IOptions<FeatureSettings> features,
        ILogger<ReviewService> logger)
    {
        _db = db;
        _notify = notify;
        _features = features.Value;
        _logger = logger;
    }

    public async Task<ReviewSubmitResult> SubmitAsync(
        int productId, string userId, int rating, string? title, string comment)
    {
        if (!_features.EnableReviews)
            return new ReviewSubmitResult(false, "Reviews are currently disabled.", false);

        if (rating is < 1 or > 5)
            return new ReviewSubmitResult(false, "Please select a rating between 1 and 5 stars.", false);

        var product = await _db.Products.FindAsync(productId);
        if (product is null)
            return new ReviewSubmitResult(false, "This product no longer exists.", false);

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
            return new ReviewSubmitResult(false, "Please sign in to leave a review.", false);

        var hasPurchased = await HasPurchasedAsync(productId, userId);

        if (_features.RequirePurchaseToReview && !hasPurchased)
        {
            return new ReviewSubmitResult(false,
                "Only customers who have purchased this product can review it.", false);
        }

        var moderate = _features.ModerateReviews;
        var status = moderate ? ReviewStatus.Pending : ReviewStatus.Approved;

        var existing = await _db.Reviews
            .FirstOrDefaultAsync(r => r.ProductId == productId && r.UserId == userId);

        if (existing is not null)
        {
            existing.Rating = rating;
            existing.Title = title?.Trim();
            existing.Comment = comment.Trim();
            existing.IsVerifiedPurchase = hasPurchased;
            existing.Status = status;
            existing.CreatedDate = DateTime.UtcNow;
            existing.ModeratedDate = null;
        }
        else
        {
            existing = new Review
            {
                ProductId = productId,
                UserId = userId,
                AuthorName = string.IsNullOrWhiteSpace(user.FullName) ? "Customer" : user.FullName,
                Rating = rating,
                Title = title?.Trim(),
                Comment = comment.Trim(),
                IsVerifiedPurchase = hasPurchased,
                Status = status
            };
            _db.Reviews.Add(existing);
        }

        await _db.SaveChangesAsync();
        await RecalculateProductRatingAsync(productId);

        _logger.LogInformation("Review {Rating}-star submitted for product {ProductId} by {UserId}",
            rating, productId, userId);

        await _notify.NotifyNewReviewAsync(existing, product.Name);

        return new ReviewSubmitResult(true,
            moderate
                ? "Thank you! Your review has been submitted and will appear once approved."
                : "Thank you! Your review is now live.",
            moderate);
    }

    public async Task<List<Review>> GetApprovedAsync(int productId, int page = 1, int pageSize = 10)
    {
        if (page < 1) page = 1;

        return await _db.Reviews
            .AsNoTracking()
            .Where(r => r.ProductId == productId && r.Status == ReviewStatus.Approved)
            .OrderByDescending(r => r.HelpfulCount)
            .ThenByDescending(r => r.CreatedDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public Task<int> GetApprovedCountAsync(int productId) =>
        _db.Reviews.CountAsync(r => r.ProductId == productId && r.Status == ReviewStatus.Approved);

    public async Task<ReviewSummary> GetSummaryAsync(int productId)
    {
        var counts = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.ProductId == productId && r.Status == ReviewStatus.Approved)
            .GroupBy(r => r.Rating)
            .Select(g => new { Stars = g.Key, Count = g.Count() })
            .ToListAsync();

        var total = counts.Sum(c => c.Count);

        var average = total == 0
            ? 0m
            : Math.Round((decimal)counts.Sum(c => c.Stars * c.Count) / total, 2);

        var breakdown = Enumerable.Range(1, 5)
            .Reverse()
            .Select(stars =>
            {
                var count = counts.FirstOrDefault(c => c.Stars == stars)?.Count ?? 0;
                var pct = total == 0 ? 0 : Math.Round(count * 100.0 / total, 1);
                return new RatingBreakdown(stars, count, pct);
            })
            .ToList();

        return new ReviewSummary(average, total, breakdown);
    }

    public Task<Review?> GetUserReviewAsync(int productId, string userId) =>
        _db.Reviews.FirstOrDefaultAsync(r => r.ProductId == productId && r.UserId == userId);

    /// <summary>A purchase counts only once the order reached a state where money is committed.</summary>
    public Task<bool> HasPurchasedAsync(int productId, string userId) =>
        _db.OrderItems
            .AnyAsync(oi => oi.ProductId == productId &&
                            oi.Order != null &&
                            oi.Order.UserId == userId &&
                            oi.Order.OrderStatus != OrderStatus.Cancelled);

    public async Task<bool> ToggleHelpfulAsync(int reviewId, string userId)
    {
        var review = await _db.Reviews.FindAsync(reviewId);
        if (review is null) return false;

        var vote = await _db.ReviewVotes
            .FirstOrDefaultAsync(v => v.ReviewId == reviewId && v.UserId == userId);

        if (vote is null)
        {
            _db.ReviewVotes.Add(new ReviewVote { ReviewId = reviewId, UserId = userId });
            review.HelpfulCount++;
        }
        else
        {
            _db.ReviewVotes.Remove(vote);
            review.HelpfulCount = Math.Max(0, review.HelpfulCount - 1);
        }

        await _db.SaveChangesAsync();
        return true;
    }

    /// <summary>Refreshes the denormalised totals on the product row.</summary>
    public async Task RecalculateProductRatingAsync(int productId)
    {
        var product = await _db.Products.FindAsync(productId);
        if (product is null) return;

        var approved = await _db.Reviews
            .Where(r => r.ProductId == productId && r.Status == ReviewStatus.Approved)
            .Select(r => r.Rating)
            .ToListAsync();

        product.ReviewCount = approved.Count;
        product.AverageRating = approved.Count == 0
            ? 0m
            : Math.Round((decimal)approved.Sum() / approved.Count, 2);

        await _db.SaveChangesAsync();
    }
}
