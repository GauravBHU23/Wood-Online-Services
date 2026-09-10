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
}
