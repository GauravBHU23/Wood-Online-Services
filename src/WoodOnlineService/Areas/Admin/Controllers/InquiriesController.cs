using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class InquiriesController : AdminBaseController
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _db;

    public InquiriesController(ApplicationDbContext db) => _db = db;

    public async Task<IActionResult> Index(string? status, string? search, int page = 1)
    {
        if (page < 1) page = 1;

        var query = _db.Inquiries.Include(i => i.Product).AsQueryable();

        if (Enum.TryParse<InquiryStatus>(status, out var parsed))
            query = query.Where(i => i.Status == parsed);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(i => i.Name.Contains(term) || i.Phone.Contains(term) || i.Message.Contains(term));
        }

        var total = await query.CountAsync();

        var model = new AdminListViewModel<Inquiry>
        {
            Items = await query
                .OrderByDescending(i => i.CreatedDate)
                .Skip((page - 1) * PageSize)
                .Take(PageSize)
                .ToListAsync(),
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            Search = search,
            Status = status
        };

        ViewBag.NewCount = await _db.Inquiries.CountAsync(i => i.Status == InquiryStatus.New);
        ViewBag.ContactedCount = await _db.Inquiries.CountAsync(i => i.Status == InquiryStatus.Contacted);
        ViewBag.ClosedCount = await _db.Inquiries.CountAsync(i => i.Status == InquiryStatus.Closed);

        ViewData["Title"] = "Inquiries";
        return View(model);
    }

    public async Task<IActionResult> Details(int id)
    {
        var inquiry = await _db.Inquiries
            .Include(i => i.Product)
            .FirstOrDefaultAsync(i => i.InquiryId == id);

        if (inquiry is null) return NotFound();

        ViewData["Title"] = $"Inquiry #{inquiry.InquiryId}";
        return View(inquiry);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> UpdateStatus(int id, InquiryStatus status, string? adminNotes, string? returnUrl)
    {
        var inquiry = await _db.Inquiries.FindAsync(id);
        if (inquiry is null) return NotFound();

        inquiry.Status = status;
        if (adminNotes is not null)
            inquiry.AdminNotes = adminNotes.Trim();

        await _db.SaveChangesAsync();

        TempData["Success"] = $"Inquiry #{id} status set to \"{status}\" .";

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction(nameof(Details), new { id });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var inquiry = await _db.Inquiries.FindAsync(id);
        if (inquiry is null) return NotFound();

        _db.Inquiries.Remove(inquiry);
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Inquiry #{id} has been deleted.";
        return RedirectToAction(nameof(Index));
    }
}
