using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WoodOnlineService.Services;

namespace WoodOnlineService.Controllers.Api;

[ApiController]
[Route("api/visitor")]
[EnableRateLimiting("general")]
public class VisitorApiController : ControllerBase
{
    private readonly IVisitorService _visitors;

    public VisitorApiController(IVisitorService visitors) => _visitors = visitors;

    /// <summary>
    /// Powers the footer badge. Returns the total visit count and the caller's own address and
    /// location only — one visitor can never see another visitor's IP through this endpoint.
    /// </summary>
    [HttpGet("info")]
    [AllowAnonymous]
    public async Task<IActionResult> Info(CancellationToken ct)
    {
        var info = await _visitors.TrackAndGetAsync(HttpContext, ct);

        return Ok(new
        {
            success = true,
            ipAddress = info.IpAddress,
            location = info.LocationLabel,
            city = info.City,
            region = info.Region,
            country = info.Country,
            countryCode = info.CountryCode,
            totalVisits = info.TotalVisits
        });
    }
}
