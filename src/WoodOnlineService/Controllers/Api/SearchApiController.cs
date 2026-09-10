using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using WoodOnlineService.Data;

namespace WoodOnlineService.Controllers.Api;

[ApiController]
[Route("api/search")]
[EnableRateLimiting("general")]
public class SearchApiController : ControllerBase
{
    private const int MaxSuggestions = 8;

    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;

    public SearchApiController(ApplicationDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    /// <summary>
    /// Autocomplete for the header search box. Public by design — it only ever returns
    /// products that are already visible on the catalogue pages.
    /// </summary>
    [HttpGet("suggest")]
    [AllowAnonymous]
    public async Task<IActionResult> Suggest([FromQuery] string? q)
    {
        var term = q?.Trim();

        if (string.IsNullOrWhiteSpace(term) || term.Length < 2)
            return Ok(new { success = true, results = Array.Empty<object>() });

        // Cap the input so a huge string can't be used to make the database work hard.
        if (term.Length > 60) term = term[..60];

        var cacheKey = $"suggest_{term.ToLowerInvariant()}";
        if (_cache.TryGetValue(cacheKey, out object? cached))
            return Ok(new { success = true, results = cached });

        var products = await _db.Products
            .AsNoTracking()
            .Where(p => p.IsAvailable &&
                        (p.Name.Contains(term) ||
                         (p.WoodType != null && p.WoodType.Contains(term)) ||
                         (p.Category != null && p.Category.Name.Contains(term))))
            .OrderByDescending(p => p.IsFeatured)
            .ThenByRating(_db.IsSqliteProvider())
            .Take(MaxSuggestions)
            .Select(p => new
            {
                id = p.ProductId,
                name = p.Name,
                category = p.Category!.Name,
                woodType = p.WoodType,
                price = p.Price,
                isCustomOrder = p.IsCustomOrder,
                rating = p.AverageRating,
                reviewCount = p.ReviewCount,
                image = p.ImageUrl
            })
            .ToListAsync();

        _cache.Set(cacheKey, products, TimeSpan.FromMinutes(5));

        return Ok(new { success = true, results = products });
    }

    /// <summary>Popular search terms shown before the customer types anything.</summary>
    [HttpGet("popular")]
    [AllowAnonymous]
    public async Task<IActionResult> Popular()
    {
        const string cacheKey = "search_popular";

        if (_cache.TryGetValue(cacheKey, out object? cached))
            return Ok(new { success = true, results = cached });

        var categories = await _db.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Take(6)
            .Select(c => new { id = c.CategoryId, name = c.Name })
            .ToListAsync();

        _cache.Set(cacheKey, categories, TimeSpan.FromMinutes(30));

        return Ok(new { success = true, results = categories });
    }
}
