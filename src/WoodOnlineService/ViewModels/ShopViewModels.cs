using System.ComponentModel.DataAnnotations;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.ViewModels;

public class HomeViewModel
{
    public List<Category> Categories { get; set; } = [];
    public List<Product> FeaturedProducts { get; set; } = [];
    public List<Product> LatestProducts { get; set; } = [];
    public List<Product> TopRatedProducts { get; set; } = [];
}

public class ShopViewModel
{
    public List<Product> Products { get; set; } = [];
    public List<Category> Categories { get; set; } = [];

    public int? CategoryId { get; set; }
    public string? Search { get; set; }
    public string? WoodType { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public int? MinRating { get; set; }
    public string Sort { get; set; } = "newest";

    public List<string> WoodTypes { get; set; } = [];

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public int TotalCount { get; set; }
    public int TotalPages => PageSize <= 0 ? 1 : (int)Math.Ceiling(TotalCount / (double)PageSize);

    public string? CategoryName { get; set; }

    public bool HasActiveFilters =>
        CategoryId is not null ||
        !string.IsNullOrWhiteSpace(Search) ||
        !string.IsNullOrWhiteSpace(WoodType) ||
        MinPrice is not null ||
        MaxPrice is not null ||
        MinRating is not null;
}

public class ProductDetailViewModel
{
    public Product Product { get; set; } = new();
    public List<Product> Related { get; set; } = [];
    public InquiryFormModel InquiryForm { get; set; } = new();

    public ReviewSummary ReviewSummary { get; set; } = new(0, 0, []);
    public List<Review> Reviews { get; set; } = [];
    public Review? UserReview { get; set; }
    public bool UserHasPurchased { get; set; }
    public List<int> VotedReviewIds { get; set; } = [];

    public int ReviewPage { get; set; } = 1;
    public int ReviewTotalPages { get; set; } = 1;
}

public class InquiryFormModel
{
    [Required(ErrorMessage = "Please enter your name")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters")]
    [Display(Name = "Your Name")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please enter your phone number")]
    [StringLength(20)]
    [RegularExpression(@"^[0-9+\-\s()]{7,20}$", ErrorMessage = "Please enter a valid phone number")]
    [Display(Name = "Phone / WhatsApp")]
    public string Phone { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "Please enter a valid email address")]
    [StringLength(150)]
    [Display(Name = "Email (optional)")]
    public string? Email { get; set; }

    public int? ProductId { get; set; }

    [Required(ErrorMessage = "Please write your message")]
    [StringLength(2000, MinimumLength = 10, ErrorMessage = "Message must be between 10 and 2000 characters")]
    [Display(Name = "Your Message")]
    public string Message { get; set; } = string.Empty;
}
