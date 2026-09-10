using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public record VisitorInfo(
    string IpAddress,
    string? City,
    string? Region,
    string? Country,
    string? CountryCode,
    long TotalVisits)
{
    public string LocationLabel
    {
        get
        {
            var parts = new[] { City, Region, Country }
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();

            return parts.Length > 0 ? string.Join(", ", parts) : "Unknown location";
        }
    }
}

public interface IVisitorService
{
    Task<VisitorInfo> TrackAndGetAsync(HttpContext http, CancellationToken ct = default);
    string GetClientIp(HttpContext http);
}

public class VisitorService : IVisitorService
{
    private const string SessionCookie = "wos_vid";
    private const string CounterCacheKey = "visitor_total";

    private readonly ApplicationDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly IHttpClientFactory _httpFactory;
    private readonly FeatureSettings _features;
    private readonly ILogger<VisitorService> _logger;

    public VisitorService(
        ApplicationDbContext db,
        IMemoryCache cache,
        IHttpClientFactory httpFactory,
        IOptions<FeatureSettings> features,
        ILogger<VisitorService> logger)
    {
        _db = db;
        _cache = cache;
        _httpFactory = httpFactory;
        _features = features.Value;
        _logger = logger;
    }

    /// <summary>
    /// Resolves the caller's address, preferring the proxy headers Azure App Service sets.
    /// Only the first hop of X-Forwarded-For is meaningful; the rest can be spoofed by the client.
    /// </summary>
    public string GetClientIp(HttpContext http)
    {
        var forwarded = http.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            var first = forwarded.Split(',')[0].Trim();

            // Azure appends the source port, e.g. "203.0.113.4:51234".
            var colon = first.LastIndexOf(':');
            if (colon > 0 && first.Count(c => c == ':') == 1)
                first = first[..colon];

            if (IPAddress.TryParse(first, out var parsed))
                return parsed.ToString();
        }

        var real = http.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(real) && IPAddress.TryParse(real.Trim(), out var realParsed))
            return realParsed.ToString();

        var remote = http.Connection.RemoteIpAddress;
        if (remote is null) return "0.0.0.0";

        // ::ffff:127.0.0.1 reads better as 127.0.0.1.
        if (remote.IsIPv4MappedToIPv6) remote = remote.MapToIPv4();

        return remote.ToString();
    }

    public async Task<VisitorInfo> TrackAndGetAsync(HttpContext http, CancellationToken ct = default)
    {
        var ip = GetClientIp(http);

        if (!_features.EnableVisitorCounter)
            return new VisitorInfo(ip, null, null, null, null, 0);

        try
        {
            var isNewSession = !http.Request.Cookies.ContainsKey(SessionCookie);

            if (isNewSession)
            {
                http.Response.Cookies.Append(SessionCookie, Guid.NewGuid().ToString("N"), new CookieOptions
                {
                    HttpOnly = true,
                    IsEssential = true,
                    SameSite = SameSiteMode.Lax,
                    Secure = http.Request.IsHttps,
                    Expires = DateTimeOffset.UtcNow.AddDays(1)
                });
            }

            var geo = await GetGeoLocationAsync(ip, ct);
            var total = await RecordVisitAsync(http, ip, geo, isNewSession, ct);

            return new VisitorInfo(ip, geo?.City, geo?.Region, geo?.Country, geo?.CountryCode, total);
        }
        catch (Exception ex)
        {
            // The footer is decoration; it must never take a page down.
            _logger.LogWarning(ex, "Visitor tracking failed for {Ip}", ip);
            return new VisitorInfo(ip, null, null, null, null, 0);
        }
    }

    private async Task<long> RecordVisitAsync(
        HttpContext http, string ip, GeoResult? geo, bool isNewSession, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var existing = await _db.VisitorLogs
            .Where(v => v.IpAddress == ip && v.FirstSeen >= today)
            .FirstOrDefaultAsync(ct);

        if (existing is null)
        {
            _db.VisitorLogs.Add(new VisitorLog
            {
                IpAddress = ip,
                City = geo?.City,
                Region = geo?.Region,
                Country = geo?.Country,
                CountryCode = geo?.CountryCode,
                UserAgent = Truncate(http.Request.Headers.UserAgent.ToString(), 300),
                LandingPage = Truncate(http.Request.Path.Value, 300),
                Referrer = Truncate(http.Request.Headers.Referer.ToString(), 300)
            });
        }
        else
        {
            existing.LastSeen = DateTime.UtcNow;
            existing.PageViews++;
        }

        var counter = await _db.VisitorCounters.FirstOrDefaultAsync(ct);
        if (counter is null)
        {
            counter = new VisitorCounter { TotalVisits = 0, TotalPageViews = 0 };
            _db.VisitorCounters.Add(counter);
        }

        if (isNewSession) counter.TotalVisits++;
        counter.TotalPageViews++;
        counter.LastUpdated = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        _cache.Set(CounterCacheKey, counter.TotalVisits, TimeSpan.FromSeconds(30));
        return counter.TotalVisits;
    }

    private async Task<GeoResult?> GetGeoLocationAsync(string ip, CancellationToken ct)
    {
        if (!_features.EnableGeoLocation || IsPrivateAddress(ip))
            return null;

        var cacheKey = $"geo_{ip}";
        if (_cache.TryGetValue<GeoResult>(cacheKey, out var cached))
            return cached;

        try
        {
            var client = _httpFactory.CreateClient("geo");
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(3));

            var url = $"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city";
            var json = await client.GetStringAsync(url, cts.Token);

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("status", out var status) ||
                !string.Equals(status.GetString(), "success", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            var result = new GeoResult(
                root.TryGetProperty("city", out var c) ? c.GetString() : null,
                root.TryGetProperty("regionName", out var r) ? r.GetString() : null,
                root.TryGetProperty("country", out var co) ? co.GetString() : null,
                root.TryGetProperty("countryCode", out var cc) ? cc.GetString() : null);

            _cache.Set(cacheKey, result, TimeSpan.FromHours(12));
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Geo lookup failed for {Ip}", ip);
            return null;
        }
    }

    private static bool IsPrivateAddress(string ip)
    {
        if (!IPAddress.TryParse(ip, out var addr)) return true;
        if (IPAddress.IsLoopback(addr)) return true;

        var b = addr.GetAddressBytes();
        if (b.Length != 4) return addr.IsIPv6LinkLocal || addr.IsIPv6SiteLocal;

        return b[0] switch
        {
            10 => true,
            127 => true,
            172 => b[1] >= 16 && b[1] <= 31,
            192 => b[1] == 168,
            169 => b[1] == 254,
            0 => true,
            _ => false
        };
    }

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrEmpty(value) ? null : value.Length <= max ? value : value[..max];

    private sealed record GeoResult(string? City, string? Region, string? Country, string? CountryCode);
}
