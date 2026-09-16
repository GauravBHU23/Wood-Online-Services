using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace WoodOnlineService.Models;

public class ApplicationUser : IdentityUser
{
    [StringLength(100)]
    [Display(Name = "Full Name")]
    public string FullName { get; set; } = string.Empty;

    [StringLength(300)]
    public string? Address { get; set; }

    [StringLength(100)]
    public string? City { get; set; }

    [StringLength(100)]
    public string? State { get; set; }

    [StringLength(10)]
    public string? PinCode { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// True for the seeded admin account until it changes its own password. Blocks every other
    /// action so a default/well-known password can never be left in place.
    /// </summary>
    public bool MustChangePassword { get; set; }

    /// <summary>
    /// Identifies the one device/browser currently allowed to be signed in as this user. Set to
    /// a new value on every successful login; any cookie carrying an older value is signed out
    /// on its next request, so logging in somewhere new ends the session everywhere else.
    /// </summary>
    [StringLength(64)]
    public string? CurrentSessionId { get; set; }
}
