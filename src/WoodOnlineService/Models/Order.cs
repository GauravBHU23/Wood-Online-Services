using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WoodOnlineService.Models;

public enum OrderStatus
{
    Pending = 0,
    Confirmed = 1,
    Shipped = 2,
    Delivered = 3,
    Cancelled = 4
}

public enum PaymentStatus
{
    Pending = 0,
    Paid = 1,
    Failed = 2,
    Refunded = 3
}

public enum PaymentMethod
{
    CashOnDelivery = 0,
    Online = 1
}

public class Order
{
    public int OrderId { get; set; }

    /// <summary>Human-friendly reference shown to the customer, e.g. WOS-20260815-0007.</summary>
    [StringLength(30)]
    public string OrderNumber { get; set; } = string.Empty;

    [Required]
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }

    public DateTime OrderDate { get; set; } = DateTime.UtcNow;

    // Shipping address is copied onto the order so later profile edits don't rewrite history.
    [Required(ErrorMessage = "Name is required")]
    [StringLength(100)]
    [Display(Name = "Full Name")]
    public string ShippingName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required")]
    [StringLength(20)]
    [RegularExpression(@"^[0-9+\-\s]{7,20}$", ErrorMessage = "Please enter a valid phone number")]
    [Display(Name = "Phone")]
    public string ShippingPhone { get; set; } = string.Empty;

    [Required(ErrorMessage = "Address is required")]
    [StringLength(300)]
    [Display(Name = "Address")]
    public string ShippingAddress { get; set; } = string.Empty;

    [Required(ErrorMessage = "City is required")]
    [StringLength(100)]
    [Display(Name = "City")]
    public string ShippingCity { get; set; } = string.Empty;

    [Required(ErrorMessage = "State is required")]
    [StringLength(100)]
    [Display(Name = "State")]
    public string ShippingState { get; set; } = string.Empty;

    [Required(ErrorMessage = "PIN code is required")]
    [StringLength(10)]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Please enter a 6-digit PIN code")]
    [Display(Name = "PIN Code")]
    public string ShippingPinCode { get; set; } = string.Empty;

    [StringLength(500)]
    [Display(Name = "Delivery Notes (optional)")]
    public string? Notes { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal SubTotal { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal ShippingCharge { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalAmount { get; set; }

    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;
    public OrderStatus OrderStatus { get; set; } = OrderStatus.Pending;

    [StringLength(100)]
    public string? PaymentReference { get; set; }

    [StringLength(100)]
    [Display(Name = "Tracking Number")]
    public string? TrackingNumber { get; set; }

    public DateTime? ShippedDate { get; set; }
    public DateTime? DeliveredDate { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}

public class OrderItem
{
    public int OrderItemId { get; set; }

    public int OrderId { get; set; }
    public Order? Order { get; set; }

    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Name and price are snapshotted at purchase time so the invoice stays correct if the product changes later.</summary>
    [StringLength(200)]
    public string ProductName { get; set; } = string.Empty;

    [Column(TypeName = "decimal(18,2)")]
    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; }

    [NotMapped]
    public decimal LineTotal => UnitPrice * Quantity;
}
