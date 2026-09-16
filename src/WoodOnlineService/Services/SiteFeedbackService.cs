using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public record SiteFeedbackSubmitResult(bool Success, string Message);

public interface ISiteFeedbackService
{
    Task<SiteFeedbackSubmitResult> SubmitAsync(string userId, int rating, string comment, bool fromWelcomePrompt);

    /// <summary>Whether this user has already left site feedback — the welcome prompt only ever shows once.</summary>
    Task<bool> HasSubmittedAsync(string userId);
}

public class SiteFeedbackService : ISiteFeedbackService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SiteFeedbackService> _logger;

    public SiteFeedbackService(ApplicationDbContext db, ILogger<SiteFeedbackService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<SiteFeedbackSubmitResult> SubmitAsync(
        string userId, int rating, string comment, bool fromWelcomePrompt)
    {
        if (rating is < 1 or > 5)
            return new SiteFeedbackSubmitResult(false, "Please select a rating between 1 and 5 stars.");

        comment = comment.Trim();
        if (comment.Length is < 5 or > 1000)
            return new SiteFeedbackSubmitResult(false, "Feedback must be between 5 and 1000 characters.");

        var user = await _db.Users.FindAsync(userId);
        if (user is null)
            return new SiteFeedbackSubmitResult(false, "Please sign in to leave feedback.");

        _db.SiteFeedbacks.Add(new SiteFeedback
        {
            UserId = userId,
            AuthorName = string.IsNullOrWhiteSpace(user.FullName) ? "Customer" : user.FullName,
            Rating = rating,
            Comment = comment,
            FromWelcomePrompt = fromWelcomePrompt
        });

        await _db.SaveChangesAsync();

        _logger.LogInformation("Site feedback {Rating}-star submitted by {UserId} (welcome prompt: {FromWelcome})",
            rating, userId, fromWelcomePrompt);

        return new SiteFeedbackSubmitResult(true, "Thank you for your feedback!");
    }

    public Task<bool> HasSubmittedAsync(string userId) =>
        _db.SiteFeedbacks.AnyAsync(f => f.UserId == userId);
}
