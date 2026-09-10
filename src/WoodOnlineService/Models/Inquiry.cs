using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

public enum InquiryStatus
{
    New = 0,
    Contacted = 1,
    Closed = 2
}

public class Inquiry
{
    [Key]
    public int InquiryId { get; set; }

    [Required(ErrorMessage = "Please enter your name")]
    [StringLength(100)]
    [Display(Name = "Your Name")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required")]
    [StringLength(20)]
    [RegularExpression(@"^[0-9+\-\s]{7,20}$", ErrorMessage = "Please enter a valid phone number")]
    [Display(Name = "Phone / WhatsApp")]
    public string Phone { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "Please enter a valid email address")]
    [StringLength(150)]
    public string? Email { get; set; }

    [Display(Name = "Product")]
    public int? ProductId { get; set; }
    public Product? Product { get; set; }

    [Required(ErrorMessage = "Please write your message")]
    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    public InquiryStatus Status { get; set; } = InquiryStatus.New;

    [StringLength(1000)]
    [Display(Name = "Admin Notes")]
    public string? AdminNotes { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
}
