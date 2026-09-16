using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

/// <summary>
/// Stamps every sign-in principal with the user's current <see cref="ApplicationUser.CurrentSessionId"/>
/// as a claim. The cookie validator in Program.cs compares this claim against the value on the
/// user record on every request, which is what makes a newer login elsewhere sign an older
/// device out — the cookie itself never changes, only the record it is compared against does.
/// </summary>
public class SessionClaimsPrincipalFactory : UserClaimsPrincipalFactory<ApplicationUser, IdentityRole>
{
    public SessionClaimsPrincipalFactory(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        Microsoft.Extensions.Options.IOptions<IdentityOptions> options)
        : base(userManager, roleManager, options)
    {
    }

    public override async Task<ClaimsPrincipal> CreateAsync(ApplicationUser user)
    {
        var principal = await base.CreateAsync(user);

        if (!string.IsNullOrEmpty(user.CurrentSessionId))
        {
            ((ClaimsIdentity)principal.Identity!).AddClaim(
                new Claim("wos_session_id", user.CurrentSessionId));
        }

        return principal;
    }
}
