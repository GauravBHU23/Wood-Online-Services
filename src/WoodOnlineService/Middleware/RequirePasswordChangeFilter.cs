using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using WoodOnlineService.Models;

namespace WoodOnlineService.Middleware;

/// <summary>
/// Locks a signed-in user to the Change Password page while their account carries a default or
/// freshly-generated password (<see cref="ApplicationUser.MustChangePassword"/>). Enforced here,
/// globally, rather than only redirecting at login — otherwise the flag could be bypassed simply
/// by navigating straight to any other URL after signing in.
/// </summary>
public class RequirePasswordChangeFilter : IAsyncActionFilter
{
    // Must stay reachable while the flag is set: the page itself, sign-out, the account
    // controller's own chrome endpoints, static assets, and the health/webhook surfaces that
    // are never reached by a browser session at all.
    private static readonly HashSet<string> AllowedActions = new(StringComparer.OrdinalIgnoreCase)
    {
        "Account/ChangePassword",
        "Account/Logout"
    };

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var httpContext = context.HttpContext;

        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            var controller = context.RouteData.Values["controller"]?.ToString();
            var action = context.RouteData.Values["action"]?.ToString();
            var key = $"{controller}/{action}";

            if (!AllowedActions.Contains(key))
            {
                var userManager = httpContext.RequestServices.GetService<UserManager<ApplicationUser>>();
                if (userManager is not null)
                {
                    var user = await userManager.GetUserAsync(httpContext.User);
                    if (user?.MustChangePassword == true)
                    {
                        context.Result = new RedirectToActionResult("ChangePassword", "Account", null);
                        return;
                    }
                }
            }
        }

        await next();
    }
}
