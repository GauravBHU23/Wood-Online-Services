using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;
using WoodOnlineService.ViewModels;

namespace WoodOnlineService.Controllers;

public class HomeController : BaseController
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notify;
    private readonly ILogger<HomeController> _logger;

    public HomeController(ApplicationDbContext db, INotificationService notify, ILogger<HomeController> logger)
    {
        _db = db;
        _notify = notify;
        _logger = logger;
    }

    public async Task<IActionResult> Index()
    {
        var model = new HomeViewModel
        {
            Categories = await _db.Categories
                .AsNoTracking()
                .Where(c => c.IsActive)
                .OrderBy(c => c.DisplayOrder)
                .Include(c => c.Products.Where(p => p.IsAvailable))
                .ToListAsync(),

            FeaturedProducts = await _db.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Where(p => p.IsFeatured && p.IsAvailable)
                .OrderByDescending(p => p.CreatedDate)
                .Take(8)
                .ToListAsync(),

            LatestProducts = await _db.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Where(p => p.IsAvailable)
                .OrderByDescending(p => p.ProductId)
                .Take(4)
                .ToListAsync(),

            TopRatedProducts = await _db.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Where(p => p.IsAvailable && p.ReviewCount > 0)
                .OrderByRating(_db.IsSqliteProvider())
                .ThenByDescending(p => p.ReviewCount)
                .Take(4)
                .ToListAsync()
        };

        ViewData["Title"] = "Home";
        return View(model);
    }

    public IActionResult About()
    {
        ViewData["Title"] = "About Us";
        ViewData["MetaDescription"] =
            "About our workshop - our craft, the quality of wood we use, and the promise we make.";
        return View();
    }

    public async Task<IActionResult> Contact(int? productId)
    {
        ViewData["Title"] = "Contact Us";

        var form = new InquiryFormModel { ProductId = productId };

        if (productId is not null)
        {
            var product = await _db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.ProductId == productId);

            if (product is not null)
            {
                ViewBag.ProductName = product.Name;
                form.Message = $"I would like more information about \"{product.Name}\". ";
            }
        }

        return View(form);
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Contact(InquiryFormModel form)
    {
        if (!ModelState.IsValid)
        {
            if (form.ProductId is not null)
            {
                ViewBag.ProductName = await _db.Products
                    .Where(p => p.ProductId == form.ProductId)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync();
            }

            ViewData["Title"] = "Contact Us";
            TempData["Error"] = "Please correct the highlighted fields and try again.";
            return View(form);
        }

        var inquiry = new Inquiry
        {
            Name = form.Name.Trim(),
            Phone = form.Phone.Trim(),
            Email = string.IsNullOrWhiteSpace(form.Email) ? null : form.Email.Trim(),
            ProductId = form.ProductId,
            Message = form.Message.Trim(),
            Status = InquiryStatus.New
        };

        _db.Inquiries.Add(inquiry);
        await _db.SaveChangesAsync();

        inquiry.Product = form.ProductId is null
            ? null
            : await _db.Products.FindAsync(form.ProductId);

        await _notify.NotifyNewInquiryAsync(inquiry);

        _logger.LogInformation("New inquiry #{Id} from {Name}", inquiry.InquiryId, inquiry.Name);

        TempData["Success"] = "Thank you! We have received your message and will contact you shortly.";
        return RedirectToAction(nameof(ThankYou));
    }

    public IActionResult ThankYou()
    {
        ViewData["Title"] = "Thank You";
        return View();
    }

    public IActionResult Privacy()
    {
        ViewData["Title"] = "Privacy Policy";
        return View();
    }

    public IActionResult Terms()
    {
        ViewData["Title"] = "Terms & Conditions";
        return View();
    }

    public IActionResult License()
    {
        ViewData["Title"] = "License";
        return View();
    }

    /// <summary>Shown when the rate limiter rejects a browser request.</summary>
    public IActionResult TooManyRequests()
    {
        Response.StatusCode = StatusCodes.Status429TooManyRequests;
        ViewData["Title"] = "Too Many Requests";
        return View();
    }

    [Route("Home/Error/{code:int?}")]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error(int? code, [FromQuery] string? @ref)
    {
        ViewData["Title"] = code == 404 ? "Page Not Found" : "Something Went Wrong";
        ViewBag.StatusCode = code;
        ViewBag.Reference = @ref;
        return View();
    }
}
