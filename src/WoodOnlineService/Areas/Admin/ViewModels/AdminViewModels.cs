using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using WoodOnlineService.Models;

namespace WoodOnlineService.Areas.Admin.ViewModels;

/// <summary>One row of the admin user directory — identity fields plus a few numbers pulled from orders.</summary>
public class UserListItem
{
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public DateTime CreatedDate { get; set; }
    public bool IsAdmin { get; set; }
    public bool IsBlocked { get; set; }
    public DateTimeOffset? LockoutEnd { get; set; }

    public int OrderCount { get; set; }
    public decimal TotalSpend { get; set; }
}

public class DashboardViewModel
{
    public int TotalProducts { get; set; }
    public int OutOfStockCount { get; set; }
    public int TotalCategories { get; set; }

    public int NewInquiries { get; set; }
    public int TotalInquiries { get; set; }

    public int PendingOrders { get; set; }
    public int TotalOrders { get; set; }

    public decimal TotalRevenue { get; set; }
    public decimal RevenueLast30Days { get; set; }

    public int TotalCustomers { get; set; }

    public List<Order> RecentOrders { get; set; } = [];
    public List<Inquiry> RecentInquiries { get; set; } = [];
    public List<Product> LowStockProducts { get; set; } = [];
}

public class ProductFormViewModel
{
    public int ProductId { get; set; }

    [Required(ErrorMessage = "Product name is required")]
    [StringLength(200)]
    [Display(Name = "Product Name")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please choose a category")]
    [Display(Name = "Category")]
    public int CategoryId { get; set; }

    [StringLength(100)]
    [Display(Name = "Wood Type")]
    public string? WoodType { get; set; }

    [StringLength(2000)]
    [Display(Name = "Description")]
    public string? Description { get; set; }

    [Range(0, 10000000, ErrorMessage = "Price must be 0 or more")]
    [Display(Name = "Price (₹)")]
    public decimal Price { get; set; }

    [Range(0, 10000000)]
    [Display(Name = "MRP / Old Price (₹)")]
    public decimal? OldPrice { get; set; }

    [StringLength(150)]
    [Display(Name = "Dimensions (L × W × H)")]
    public string? Dimensions { get; set; }

    [Range(0, 100000, ErrorMessage = "Stock must be 0 or more")]
    [Display(Name = "Stock Quantity")]
    public int StockQuantity { get; set; }

    [Display(Name = "Available (show on site)")]
    public bool IsAvailable { get; set; } = true;

    [Display(Name = "Show on homepage")]
    public bool IsFeatured { get; set; }

    [Display(Name = "Custom Order Only (price on request)")]
    public bool IsCustomOrder { get; set; }

    [Display(Name = "Main Image")]
    public string? ImageUrl { get; set; }

    [Display(Name = "New main image (upload)")]
    public IFormFile? MainImage { get; set; }

    [Display(Name = "More Images (upload)")]
    public List<IFormFile>? GalleryImages { get; set; }

    public List<ProductImage> ExistingImages { get; set; } = [];
    public List<Category> Categories { get; set; } = [];
}

public class CategoryFormViewModel
{
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "Category name is required")]
    [StringLength(100)]
    [Display(Name = "Category Name")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    [Display(Name = "Description")]
    public string? Description { get; set; }

    [Display(Name = "Display Order")]
    public int DisplayOrder { get; set; }

    [Display(Name = "Active")]
    public bool IsActive { get; set; } = true;

    [Display(Name = "Image")]
    public string? ImageUrl { get; set; }

    [Display(Name = "New image (upload)")]
    public IFormFile? Image { get; set; }

    public int ProductCount { get; set; }
}

public class AdminListViewModel<T>
{
    public List<T> Items { get; set; } = [];
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public int TotalCount { get; set; }
    public int TotalPages => PageSize <= 0 ? 1 : (int)Math.Ceiling(TotalCount / (double)PageSize);
    public string? Search { get; set; }
    public string? Status { get; set; }
    public int? CategoryId { get; set; }
}
