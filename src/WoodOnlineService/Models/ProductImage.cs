using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

public class ProductImage
{
    [Key]
    public int ImageId { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [StringLength(300)]
    public string ImagePath { get; set; } = string.Empty;

    [StringLength(200)]
    public string? AltText { get; set; }

    public int DisplayOrder { get; set; }
}
