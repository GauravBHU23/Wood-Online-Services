using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

/// <summary>
/// Cart lives in the DB rather than session so it survives logout/device switch.
/// Guests get a cookie-backed <see cref="CartKey"/>; on login the guest cart is merged into the user's.
/// </summary>
public class CartItem
{
    public int CartItemId { get; set; }

    [Required]
    [StringLength(100)]
    public string CartKey { get; set; } = string.Empty;

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    public int Quantity { get; set; }

    public DateTime AddedDate { get; set; } = DateTime.UtcNow;
}
