using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class FeedbackController : AdminBaseController
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _db;
    private readonly ILogger<FeedbackController> _logger;

    public FeedbackController(ApplicationDbContext db, ILogger<FeedbackController> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string? search, int page = 1)
    {
        if (page < 1) page = 1;

        var query = _db.SiteFeedbacks.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(f => f.AuthorName.Contains(term) || f.Comment.Contains(term));
        }

        var total = await query.CountAsync();

        var model = new AdminListViewModel<SiteFeedback>
        {
            Items = await query
                .OrderByDescending(f => f.CreatedDate)
                .Skip((page - 1) * PageSize)
                .Take(PageSize)
                .ToListAsync(),
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            Search = search
        };

        var ratings = await _db.SiteFeedbacks.Select(f => f.Rating).ToListAsync();
        ViewBag.AverageRating = ratings.Count == 0 ? 0m : Math.Round((decimal)ratings.Sum() / ratings.Count, 2);
        ViewBag.TotalCount = ratings.Count;

        ViewData["Title"] = "Site Feedback";
        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Respond(int id, string? adminResponse)
    {
        var feedback = await _db.SiteFeedbacks.FindAsync(id);
        if (feedback is null) return NotFound();

        feedback.AdminResponse = string.IsNullOrWhiteSpace(adminResponse) ? null : adminResponse.Trim();
        await _db.SaveChangesAsync();

        _logger.LogInformation("Responded to site feedback {FeedbackId}", id);

        TempData["Success"] = "Response saved.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    public async Task<IActionResult> Delete(int id)
    {
        var feedback = await _db.SiteFeedbacks.FindAsync(id);
        if (feedback is null) return NotFound();

        _db.SiteFeedbacks.Remove(feedback);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Site feedback {FeedbackId} deleted", id);

        TempData["Success"] = "Feedback deleted.";
        return RedirectToAction(nameof(Index));
    }
}
