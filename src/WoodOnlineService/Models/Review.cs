using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

public enum ReviewStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public class Review
{
    [Key]
    public int ReviewId { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }

    /// <summary>Snapshotted so the review keeps its author name even if the profile changes.</summary>
    [Required]
    [StringLength(100)]
    public string AuthorName { get; set; } = string.Empty;

    [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5 stars")]
    public int Rating { get; set; }

    [StringLength(150)]
    [Display(Name = "Title")]
    public string? Title { get; set; }

    [Required(ErrorMessage = "Please write your review")]
    [StringLength(2000, MinimumLength = 10, ErrorMessage = "Review must be between 10 and 2000 characters")]
    [Display(Name = "Your Review")]
    public string Comment { get; set; } = string.Empty;

    /// <summary>Set when the reviewer actually bought this product — shown as a trust badge.</summary>
    public bool IsVerifiedPurchase { get; set; }

    public ReviewStatus Status { get; set; } = ReviewStatus.Pending;

    public int HelpfulCount { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime? ModeratedDate { get; set; }

    [StringLength(500)]
    public string? AdminResponse { get; set; }
}

/// <summary>One row per user per review, so "helpful" can't be clicked repeatedly.</summary>
public class ReviewVote
{
    [Key]
    public int ReviewVoteId { get; set; }

    public int ReviewId { get; set; }
    public Review? Review { get; set; }

    [Required]
    public string UserId { get; set; } = string.Empty;

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
}
