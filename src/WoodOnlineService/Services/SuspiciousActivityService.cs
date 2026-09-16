using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public interface ISuspiciousActivityService
{
    /// <summary>True while this IP is under a suspicious-activity block.</summary>
    bool IsBlocked(string ipAddress);

    /// <summary>Minutes remaining on the current block, or 0 if not blocked.</summary>
    int MinutesRemaining(string ipAddress);

    /// <summary>Records one failed sign-in attempt from this IP and blocks it if the threshold is crossed.</summary>
    void RecordFailedAttempt(string ipAddress);

    /// <summary>Clears the failure count for this IP — called after a successful sign-in.</summary>
    void RecordSuccess(string ipAddress);
}

/// <summary>
/// Flags credential-stuffing-style behaviour: many failed logins from one IP in a short window,
/// regardless of which account each attempt targeted (per-account lockout alone misses this,
/// since an attacker trying ten different emails never fails the same account three times).
/// Tracked in memory rather than the database — this is short-lived, high-frequency data that
/// doesn't need to survive a restart, and doesn't belong in a durable table.
/// </summary>
public class SuspiciousActivityService : ISuspiciousActivityService
{
    private const int FailureThreshold = 10;
    private static readonly TimeSpan TrackingWindow = TimeSpan.FromMinutes(10);

    private readonly IMemoryCache _cache;
    private readonly SecuritySettings _security;
    private readonly ILogger<SuspiciousActivityService> _logger;

    public SuspiciousActivityService(
        IMemoryCache cache, IOptions<SecuritySettings> security, ILogger<SuspiciousActivityService> logger)
    {
        _cache = cache;
        _security = security.Value;
        _logger = logger;
    }

    private static string CountKey(string ip) => $"suspicious:count:{ip}";
    private static string BlockKey(string ip) => $"suspicious:block:{ip}";

    public bool IsBlocked(string ipAddress) => _cache.TryGetValue(BlockKey(ipAddress), out _);

    public int MinutesRemaining(string ipAddress)
    {
        if (_cache.TryGetValue(BlockKey(ipAddress), out DateTimeOffset until))
            return Math.Max(0, (int)Math.Ceiling((until - DateTimeOffset.UtcNow).TotalMinutes));
        return 0;
    }

    public void RecordFailedAttempt(string ipAddress)
    {
        var key = CountKey(ipAddress);
        var count = _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TrackingWindow;
            return 0;
        });

        count++;
        _cache.Set(key, count, TrackingWindow);

        if (count >= FailureThreshold)
        {
            var until = DateTimeOffset.UtcNow.AddMinutes(_security.AdminLockoutMinutes);
            _cache.Set(BlockKey(ipAddress), until, until - DateTimeOffset.UtcNow);
            _cache.Remove(key);

            _logger.LogWarning(
                "Suspicious activity: {Count} failed sign-ins from {Ip} within {Window} minutes. Blocked until {Until}.",
                count, ipAddress, TrackingWindow.TotalMinutes, until);
        }
    }

    public void RecordSuccess(string ipAddress) => _cache.Remove(CountKey(ipAddress));
}
