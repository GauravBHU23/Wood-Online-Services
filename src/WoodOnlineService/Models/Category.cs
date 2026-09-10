using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

public class Category
{
    public int CategoryId { get; set; }

    [Required(ErrorMessage = "Category name is required")]
    [StringLength(100)]
    [Display(Name = "Category Name")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    [StringLength(300)]
    [Display(Name = "Image")]
    public string? ImageUrl { get; set; }

    [Display(Name = "Display Order")]
    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
