using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WoodOnlineService.Models;

public class Product
{
    public int ProductId { get; set; }

    [Required(ErrorMessage = "Product name is required")]
    [StringLength(200)]
    [Display(Name = "Product Name")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [Display(Name = "Category")]
    public int CategoryId { get; set; }
    public Category? Category { get; set; }

    [StringLength(100)]
    [Display(Name = "Wood Type")]
    public string? WoodType { get; set; }

    [StringLength(2000)]
    public string? Description { get; set; }

    [Range(0, 10000000, ErrorMessage = "Price must be 0 or more")]
    [Column(TypeName = "decimal(18,2)")]
    [Display(Name = "Price (₹)")]
    public decimal Price { get; set; }

    /// <summary>Original price for showing a strike-through discount. Null = no discount.</summary>
    [Column(TypeName = "decimal(18,2)")]
    [Display(Name = "MRP (₹)")]
    public decimal? OldPrice { get; set; }

    [StringLength(150)]
    [Display(Name = "Dimensions (L x W x H)")]
    public string? Dimensions { get; set; }

    [StringLength(300)]
    [Display(Name = "Main Image")]
    public string? ImageUrl { get; set; }

    [Display(Name = "Stock Quantity")]
    [Range(0, 100000)]
    public int StockQuantity { get; set; }

    [Display(Name = "Available")]
    public bool IsAvailable { get; set; } = true;

    [Display(Name = "Show on Homepage")]
    public bool IsFeatured { get; set; }

    /// <summary>Custom-order items are quoted, not sold from stock — they route to an inquiry instead of the cart.</summary>
    [Display(Name = "Custom Order Only (price on request)")]
    public bool IsCustomOrder { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Denormalised rating totals, recalculated whenever a review is approved or removed.
    /// Keeps listing pages from aggregating the reviews table on every request.
    /// </summary>
    [Column(TypeName = "decimal(3,2)")]
    public decimal AverageRating { get; set; }

    public int ReviewCount { get; set; }

    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();

    [NotMapped]
    public bool InStock => IsAvailable && StockQuantity > 0;

    [NotMapped]
    public int DiscountPercent =>
        OldPrice is > 0 && OldPrice > Price
            ? (int)Math.Round((OldPrice.Value - Price) / OldPrice.Value * 100)
            : 0;
}
