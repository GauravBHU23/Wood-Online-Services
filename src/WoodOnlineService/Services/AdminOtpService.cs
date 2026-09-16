using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public enum OtpVerifyResult
{
    Success,
    InvalidCode,
    Expired,
    TooManyAttempts,
    NotFound
}

public record OtpResendResult(bool Success, Guid? NewToken, int SecondsUntilAllowed);

public interface IAdminOtpService
{
    /// <summary>Invalidates any existing code for this admin and issues a fresh 6-digit one, emailed to them.</summary>
    Task<Guid> IssueAsync(ApplicationUser admin, CancellationToken ct = default);

    Task<OtpVerifyResult> VerifyAsync(Guid publicToken, string code, CancellationToken ct = default);

    /// <summary>
    /// Re-sends a code for the same sign-in attempt, provided the resend cooldown has elapsed
    /// since the current code was issued.
    /// </summary>
    Task<OtpResendResult> ResendAsync(Guid publicToken, CancellationToken ct = default);
}

/// <summary>
/// Email-delivered one-time codes required to complete an admin sign-in. A correct password
/// alone is not enough for the Admin role: this is the second factor, checked after
/// PasswordSignInAsync succeeds but before the session actually signs in.
/// </summary>
public class AdminOtpService : IAdminOtpService
{
    private const int CodeLength = 6;
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(3);
    private const int MaxAttempts = 5;

    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notify;
    private readonly ILogger<AdminOtpService> _logger;

    public AdminOtpService(ApplicationDbContext db, INotificationService notify, ILogger<AdminOtpService> logger)
    {
        _db = db;
        _notify = notify;
        _logger = logger;
    }

    public async Task<Guid> IssueAsync(ApplicationUser admin, CancellationToken ct = default)
    {
        // Only one code should ever be redeemable at a time, so a stale one from a previous
        // attempt can't be reused alongside a freshly requested one.
        var stale = await _db.AdminLoginOtps
            .Where(o => o.UserId == admin.Id && !o.IsUsed)
            .ToListAsync(ct);
        _db.AdminLoginOtps.RemoveRange(stale);

        var code = RandomNumberGenerator.GetInt32(0, (int)Math.Pow(10, CodeLength)).ToString().PadLeft(CodeLength, '0');

        var otp = new AdminLoginOtp
        {
            PublicToken = Guid.NewGuid(),
            UserId = admin.Id,
            CodeHash = Hash(code),
            ExpiresAt = DateTime.UtcNow.Add(Lifetime)
        };

        _db.AdminLoginOtps.Add(otp);
        await _db.SaveChangesAsync(ct);

        await _notify.NotifyAdminOtpAsync(admin.Email!, admin.FullName, code, Lifetime);

        _logger.LogInformation("Admin login OTP issued for {UserId}", admin.Id);

        return otp.PublicToken;
    }

    public async Task<OtpVerifyResult> VerifyAsync(Guid publicToken, string code, CancellationToken ct = default)
    {
        var otp = await _db.AdminLoginOtps.FirstOrDefaultAsync(o => o.PublicToken == publicToken, ct);
        if (otp is null) return OtpVerifyResult.NotFound;

        if (otp.IsUsed) return OtpVerifyResult.NotFound;

        if (otp.FailedAttempts >= MaxAttempts)
            return OtpVerifyResult.TooManyAttempts;

        if (DateTime.UtcNow > otp.ExpiresAt)
            return OtpVerifyResult.Expired;

        var matches = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(Hash(code.Trim())),
            Encoding.UTF8.GetBytes(otp.CodeHash));

        if (!matches)
        {
            otp.FailedAttempts++;
            await _db.SaveChangesAsync(ct);
            return otp.FailedAttempts >= MaxAttempts ? OtpVerifyResult.TooManyAttempts : OtpVerifyResult.InvalidCode;
        }

        otp.IsUsed = true;
        await _db.SaveChangesAsync(ct);

        return OtpVerifyResult.Success;
    }

    public async Task<OtpResendResult> ResendAsync(Guid publicToken, CancellationToken ct = default)
    {
        var otp = await _db.AdminLoginOtps
            .Include(o => o.User)
            .FirstOrDefaultAsync(o => o.PublicToken == publicToken, ct);

        if (otp is null || otp.IsUsed || otp.User is null)
            return new OtpResendResult(false, null, 0);

        var elapsed = DateTime.UtcNow - otp.CreatedDate;
        if (elapsed < ResendCooldown)
        {
            var remaining = (int)Math.Ceiling((ResendCooldown - elapsed).TotalSeconds);
            return new OtpResendResult(false, null, remaining);
        }

        var newToken = await IssueAsync(otp.User, ct);
        _logger.LogInformation("Admin login OTP resent for {UserId}", otp.UserId);

        return new OtpResendResult(true, newToken, 0);
    }

    private static string Hash(string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code))).ToLowerInvariant();
}
