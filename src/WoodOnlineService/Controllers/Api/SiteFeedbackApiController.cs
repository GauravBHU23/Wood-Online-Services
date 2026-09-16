using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers.Api;

public class SiteFeedbackSubmitRequest
{
    [Range(1, 5, ErrorMessage = "Please select a rating between 1 and 5 stars.")]
    public int Rating { get; set; }

    [Required(ErrorMessage = "Please write your feedback.")]
    [StringLength(1000, MinimumLength = 5,
        ErrorMessage = "Your feedback must be between 5 and 1000 characters.")]
    public string Comment { get; set; } = string.Empty;

    public bool FromWelcomePrompt { get; set; }
}

[ApiController]
[Route("api/feedback")]
[Authorize]
public class SiteFeedbackApiController : ControllerBase
{
    private readonly ISiteFeedbackService _feedback;
    private readonly UserManager<ApplicationUser> _userManager;

    public SiteFeedbackApiController(ISiteFeedbackService feedback, UserManager<ApplicationUser> userManager)
    {
        _feedback = feedback;
        _userManager = userManager;
    }

    /// <summary>Submits one piece of general site feedback from the signed-in customer.</summary>
    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Submit([FromBody] SiteFeedbackSubmitRequest request)
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
            return Unauthorized(new { success = false, message = "Please sign in to leave feedback." });

        var result = await _feedback.SubmitAsync(userId, request.Rating, request.Comment, request.FromWelcomePrompt);

        if (!result.Success)
            return BadRequest(new { success = false, message = result.Message });

        return Ok(new { success = true, message = result.Message });
    }

    /// <summary>Tells the client whether the welcome feedback prompt should be offered at all.</summary>
    [HttpGet("eligibility")]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> Eligibility()
    {
        var userId = _userManager.GetUserId(User);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(new { success = false, message = "Please sign in first." });

        var hasSubmitted = await _feedback.HasSubmittedAsync(userId);
        return Ok(new { success = true, hasSubmitted });
    }
}
