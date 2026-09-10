using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers;

public class CartController : BaseController
{
    private readonly ICartService _cart;
    private readonly ILogger<CartController> _logger;

    public CartController(ICartService cart, ILogger<CartController> logger)
    {
        _cart = cart;
        _logger = logger;
    }

    public async Task<IActionResult> Index()
    {
        ViewData["Title"] = "Your Cart";
        return View(await _cart.GetCartAsync(HttpContext));
    }

    [HttpPost]
    public async Task<IActionResult> Add(int productId, int quantity = 1, string? returnUrl = null)
    {
        try
        {
            await _cart.AddAsync(HttpContext, productId, quantity);
            TempData["Success"] = "Added to your cart.";
        }
        catch (InvalidOperationException ex)
        {
            TempData["Error"] = ex.Message;
        }

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction(nameof(Index));
    }

    /// <summary>Same as <see cref="Add"/> but returns JSON so the listing page never reloads.</summary>
    [HttpPost]
    [EnableRateLimiting("general")]
    public async Task<IActionResult> AddAjax(int productId, int quantity = 1)
    {
        try
        {
            await _cart.AddAsync(HttpContext, productId, quantity);
            var count = await _cart.GetCountAsync(HttpContext);

            return Json(new
            {
                success = true,
                message = "Added to your cart.",
                cartCount = count
            });
        }
        catch (InvalidOperationException ex)
        {
            return Json(new { success = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Add to cart failed for product {ProductId}", productId);
            return Json(new { success = false, message = "We could not add that item. Please try again." });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Update(int productId, int quantity)
    {
        await _cart.UpdateQuantityAsync(HttpContext, productId, quantity);
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    public async Task<IActionResult> UpdateAjax(int productId, int quantity)
    {
        try
        {
            await _cart.UpdateQuantityAsync(HttpContext, productId, quantity);
            var cart = await _cart.GetCartAsync(HttpContext);

            return Json(new
            {
                success = true,
                cartCount = cart.ItemCount,
                subTotal = cart.SubTotal,
                shipping = cart.ShippingCharge,
                total = cart.Total,
                isEmpty = cart.IsEmpty
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cart update failed for product {ProductId}", productId);
            return Json(new { success = false, message = "We could not update the quantity. Please try again." });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Remove(int productId)
    {
        await _cart.RemoveAsync(HttpContext, productId);
        TempData["Success"] = "Item removed from your cart.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    public async Task<IActionResult> Clear()
    {
        await _cart.ClearAsync(_cart.GetCartKey(HttpContext));
        TempData["Success"] = "Your cart has been emptied.";
        return RedirectToAction(nameof(Index));
    }
}
