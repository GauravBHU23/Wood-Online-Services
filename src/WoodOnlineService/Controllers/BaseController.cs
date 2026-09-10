using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers;

/// <summary>
/// Fills the chrome the layout needs (cart badge, footer categories) so no
/// public controller has to remember to do it.
/// </summary>
public abstract class BaseController : Controller
{
    public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var db = HttpContext.RequestServices.GetService<ApplicationDbContext>();
        var cart = HttpContext.RequestServices.GetService<ICartService>();

        if (db is not null)
        {
            ViewBag.FooterCategories = await db.Categories
                .Where(c => c.IsActive)
                .OrderBy(c => c.DisplayOrder)
                .ToListAsync();
        }

        if (cart is not null)
        {
            ViewBag.CartCount = await cart.GetCountAsync(HttpContext);
        }

        await next();
    }
}
