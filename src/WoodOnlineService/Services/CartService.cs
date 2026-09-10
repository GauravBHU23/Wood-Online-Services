using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public record CartLine(CartItem Item, Product Product)
{
    public decimal LineTotal => Product.Price * Item.Quantity;
}

public record CartSummary(List<CartLine> Lines, decimal SubTotal, decimal ShippingCharge, decimal Total)
{
    public int ItemCount => Lines.Sum(l => l.Item.Quantity);
    public bool IsEmpty => Lines.Count == 0;
}

public interface ICartService
{
    string GetCartKey(HttpContext http);
    Task<CartSummary> GetCartAsync(HttpContext http);
    Task<int> GetCountAsync(HttpContext http);
    Task AddAsync(HttpContext http, int productId, int quantity);
    Task UpdateQuantityAsync(HttpContext http, int productId, int quantity);
    Task RemoveAsync(HttpContext http, int productId);
    Task ClearAsync(string cartKey);
    Task MergeGuestCartAsync(HttpContext http, string userId);
}

public class CartService : ICartService
{
    public const string GuestCookie = "wos_cart";
    private const int MaxQuantityPerItem = 50;

    private readonly ApplicationDbContext _db;
    private readonly SiteSettings _site;

    public CartService(ApplicationDbContext db, IOptions<SiteSettings> site)
    {
        _db = db;
        _site = site.Value;
    }

    public string GetCartKey(HttpContext http)
    {
        // Logged-in users carry their cart on their account; guests get a cookie-backed key.
        var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userId)) return $"user:{userId}";

        if (http.Request.Cookies.TryGetValue(GuestCookie, out var existing) && !string.IsNullOrWhiteSpace(existing))
            return $"guest:{existing}";

        var fresh = Guid.NewGuid().ToString("N");
        http.Response.Cookies.Append(GuestCookie, fresh, new CookieOptions
        {
            HttpOnly = true,
            IsEssential = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(30)
        });
        return $"guest:{fresh}";
    }

    private static string? GuestKeyFromCookie(HttpContext http) =>
        http.Request.Cookies.TryGetValue(GuestCookie, out var v) && !string.IsNullOrWhiteSpace(v)
            ? $"guest:{v}"
            : null;

    public async Task<CartSummary> GetCartAsync(HttpContext http)
    {
        var key = GetCartKey(http);

        var items = await _db.CartItems
            .Include(c => c.Product)
            .Where(c => c.CartKey == key)
            .OrderBy(c => c.AddedDate)
            .ToListAsync();

        // Drop anything that went out of stock or custom-order-only while it sat in the cart.
        var stale = items.Where(i => i.Product is null || i.Product.IsCustomOrder || !i.Product.IsAvailable).ToList();
        if (stale.Count > 0)
        {
            _db.CartItems.RemoveRange(stale);
            await _db.SaveChangesAsync();
            items = items.Except(stale).ToList();
        }

        var lines = items.Select(i => new CartLine(i, i.Product!)).ToList();
        var subTotal = lines.Sum(l => l.LineTotal);

        var shipping = subTotal <= 0 || subTotal >= _site.FreeShippingAbove ? 0m : _site.ShippingCharge;

        return new CartSummary(lines, subTotal, shipping, subTotal + shipping);
    }

    public async Task<int> GetCountAsync(HttpContext http)
    {
        var key = GetCartKey(http);
        return await _db.CartItems.Where(c => c.CartKey == key).SumAsync(c => (int?)c.Quantity) ?? 0;
    }

    public async Task AddAsync(HttpContext http, int productId, int quantity)
    {
        if (quantity < 1) quantity = 1;

        var product = await _db.Products.FindAsync(productId)
            ?? throw new InvalidOperationException("Product not found.");

        if (product.IsCustomOrder)
            throw new InvalidOperationException("This is a custom-order item and cannot be added to the cart. Please send an inquiry.");

        if (!product.InStock)
            throw new InvalidOperationException("This product is currently out of stock.");

        var key = GetCartKey(http);
        var existing = await _db.CartItems.FirstOrDefaultAsync(c => c.CartKey == key && c.ProductId == productId);

        var desired = (existing?.Quantity ?? 0) + quantity;
        desired = Math.Min(desired, Math.Min(product.StockQuantity, MaxQuantityPerItem));

        if (existing is null)
            _db.CartItems.Add(new CartItem { CartKey = key, ProductId = productId, Quantity = desired });
        else
            existing.Quantity = desired;

        await _db.SaveChangesAsync();
    }

    public async Task UpdateQuantityAsync(HttpContext http, int productId, int quantity)
    {
        var key = GetCartKey(http);
        var item = await _db.CartItems
            .Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.CartKey == key && c.ProductId == productId);

        if (item is null) return;

        if (quantity < 1)
        {
            _db.CartItems.Remove(item);
        }
        else
        {
            var cap = Math.Min(item.Product?.StockQuantity ?? MaxQuantityPerItem, MaxQuantityPerItem);
            item.Quantity = Math.Min(quantity, Math.Max(cap, 1));
        }

        await _db.SaveChangesAsync();
    }

    public async Task RemoveAsync(HttpContext http, int productId)
    {
        var key = GetCartKey(http);
        var item = await _db.CartItems.FirstOrDefaultAsync(c => c.CartKey == key && c.ProductId == productId);
        if (item is null) return;

        _db.CartItems.Remove(item);
        await _db.SaveChangesAsync();
    }

    public async Task ClearAsync(string cartKey)
    {
        var items = await _db.CartItems.Where(c => c.CartKey == cartKey).ToListAsync();
        if (items.Count == 0) return;

        _db.CartItems.RemoveRange(items);
        await _db.SaveChangesAsync();
    }

    /// <summary>On login, fold whatever the guest collected into their account cart.</summary>
    public async Task MergeGuestCartAsync(HttpContext http, string userId)
    {
        var guestKey = GuestKeyFromCookie(http);
        if (guestKey is null) return;

        var userKey = $"user:{userId}";
        var guestItems = await _db.CartItems.Where(c => c.CartKey == guestKey).ToListAsync();

        if (guestItems.Count > 0)
        {
            var userItems = await _db.CartItems.Where(c => c.CartKey == userKey).ToListAsync();

            foreach (var g in guestItems)
            {
                var match = userItems.FirstOrDefault(u => u.ProductId == g.ProductId);
                if (match is null)
                {
                    g.CartKey = userKey;
                }
                else
                {
                    match.Quantity = Math.Min(match.Quantity + g.Quantity, MaxQuantityPerItem);
                    _db.CartItems.Remove(g);
                }
            }

            await _db.SaveChangesAsync();
        }

        http.Response.Cookies.Delete(GuestCookie);
    }
}
