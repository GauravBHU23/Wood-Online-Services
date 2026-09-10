using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers.Api;

public class ReviewSubmitRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(1, 5, ErrorMessage = "Please select a rating between 1 and 5 stars.")]
    public int Rating { get; set; }

    [StringLength(150, ErrorMessage = "Title cannot exceed 150 characters.")]
    public string? Title { get; set; }

    [Required(ErrorMessage = "Please write your review.")]
    [StringLength(2000, MinimumLength = 10,
        ErrorMessage = "Your review must be between 10 and 2000 characters.")]
    public string Comment { get; set; } = string.Empty;
}

[ApiController]
[Route("api/reviews")]
[Authorize]
public class ReviewApiController : ControllerBase
{
    private readonly IReviewService _reviews;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<ReviewApiController> _logger;

    public ReviewApiController(
        IReviewService reviews,
        UserManager<ApplicationUser> userManager,
        ILogger<ReviewApiController> logger)
    {
        _reviews = reviews;
        _userManager = userManager;
        _logger = logger;
    }

    /// <summary>Create or replace the signed-in customer's review for one product.</summary>
    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Submit([FromBody] ReviewSubmitRequest request)
    {
        if (!ModelState.IsValid)
        {
            var message = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .FirstOrDefault() ?? "Please check the form and try again.";

            return BadRequest(new { success = false, message });
        }

        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { success = false, message = "Please sign in to leave a review." });

        var result = await _reviews.SubmitAsync(
            request.ProductId, userId, request.Rating, request.Title, request.Comment);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new
        {
            success = true,
            message = result.Message,
            requiresModeration = result.RequiresModeration
        });
    }

    /// <summary>Marks a review helpful, or removes the caller's existing vote.</summary>
    [HttpPost("{reviewId:int}/helpful")]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ToggleHelpful(int reviewId)
    {
        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { success = false, message = "Please sign in first." });

        var ok = await _reviews.ToggleHelpfulAsync(reviewId, userId);

        return ok
            ? Ok(new { success = true })
            : NotFound(new { success = false, message = "Review not found." });
    }

    /// <summary>Tells the product page whether this customer may review, and what they wrote before.</summary>
    [HttpGet("eligibility/{productId:int}")]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> Eligibility(int productId)
    {
        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { success = false, message = "Please sign in first." });

        var existing = await _reviews.GetUserReviewAsync(productId, userId);
        var purchased = await _reviews.HasPurchasedAsync(productId, userId);

        return Ok(new
        {
            success = true,
            hasPurchased = purchased,
            hasReviewed = existing is not null,
            existingReview = existing is null ? null : new
            {
                rating = existing.Rating,
                title = existing.Title,
                comment = existing.Comment,
                status = existing.Status.ToString()
            }
        });
    }
}
