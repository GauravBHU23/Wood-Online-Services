using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

/// <summary>
/// General feedback about the shop and the site itself — separate from a product
/// <see cref="Review"/>, which is always tied to one product a customer bought or browsed.
/// </summary>
public class SiteFeedback
{
    [Key]
    public int SiteFeedbackId { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }

    /// <summary>Snapshotted so feedback keeps its author name even if the profile changes.</summary>
    [Required]
    [StringLength(100)]
    public string AuthorName { get; set; } = string.Empty;

    [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5 stars")]
    public int Rating { get; set; }

    [Required(ErrorMessage = "Please write your feedback")]
    [StringLength(1000, MinimumLength = 5, ErrorMessage = "Feedback must be between 5 and 1000 characters")]
    public string Comment { get; set; } = string.Empty;

    /// <summary>True when submitted from the post-registration welcome prompt, for reporting only.</summary>
    public bool FromWelcomePrompt { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    [StringLength(500)]
    public string? AdminResponse { get; set; }
}
