using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers.Api;

public class ChatRequest
{
    [Required]
    [StringLength(200, ErrorMessage = "Please keep your question under 200 characters.")]
    public string Message { get; set; } = string.Empty;
}

[ApiController]
[Route("api/chat")]
[AllowAnonymous]
public class ChatApiController : ControllerBase
{
    private readonly IChatbotService _chatbot;

    public ChatApiController(IChatbotService chatbot) => _chatbot = chatbot;

    /// <summary>Opening message and starter questions.</summary>
    [HttpGet("start")]
    [EnableRateLimiting("general")]
    public IActionResult Start()
    {
        var reply = _chatbot.Greeting();
        return Ok(new { success = true, message = reply.Message, suggestions = reply.Suggestions });
    }

    /// <summary>
    /// Answers one question. Rate limited on the sensitive policy: it reads the database, so it
    /// should not be usable as a cheap way to generate load.
    /// </summary>
    [HttpPost]
    [IgnoreAntiforgeryToken]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Ask([FromBody] ChatRequest request, CancellationToken ct)
    {
        if (!ModelState.IsValid)
        {
            var message = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .FirstOrDefault() ?? "Please type a shorter question.";

            return BadRequest(new { success = false, message });
        }

        var reply = await _chatbot.AnswerAsync(request.Message, ct);

        return Ok(new
        {
            success = true,
            message = reply.Message,
            suggestions = reply.Suggestions,
            products = reply.Products
        });
    }
}
