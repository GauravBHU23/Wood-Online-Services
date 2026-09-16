using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

/// <summary>
/// A one-time code emailed to an admin after their password checks out, required before the
/// session actually signs in. Kept as its own short-lived row rather than a claim on the
/// (still-unauthenticated) principal, since nothing has signed in yet at the point this exists.
/// </summary>
public class AdminLoginOtp
{
    [Key]
    public int AdminLoginOtpId { get; set; }

    /// <summary>
    /// The value actually exposed to the browser (in the URL and the hidden form field).
    /// A random GUID rather than the sequential primary key, so it can't be enumerated by
    /// guessing small integers and used to skip straight to brute-forcing a code without ever
    /// having proven the account's password.
    /// </summary>
    [Required]
    public Guid PublicToken { get; set; } = Guid.NewGuid();

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }

    /// <summary>SHA-256 of the 6-digit code — the code itself is never stored at rest.</summary>
    [Required]
    [StringLength(64)]
    public string CodeHash { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; }

    /// <summary>Wrong-code attempts against this row; exhausting the budget forces a fresh code.</summary>
    public int FailedAttempts { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
}
