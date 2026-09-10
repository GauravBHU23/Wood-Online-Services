using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WoodOnlineService.Models;

public enum TransactionStatus
{
    Created = 0,
    Pending = 1,
    Success = 2,
    Failed = 3,
    Refunded = 4
}

/// <summary>
/// An audit trail of every payment attempt. Kept separate from <see cref="Order"/> so a
/// retried or failed attempt never rewrites the order's own payment state.
/// </summary>
public class PaymentTransaction
{
    [Key]
    public int PaymentTransactionId { get; set; }

    public int OrderId { get; set; }
    public Order? Order { get; set; }

    /// <summary>Instamojo's payment request id (the link we created).</summary>
    [StringLength(100)]
    public string? PaymentRequestId { get; set; }

    /// <summary>Instamojo's payment id (the actual money movement).</summary>
    [StringLength(100)]
    public string? PaymentId { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; }

    [StringLength(20)]
    public string Currency { get; set; } = "INR";

    public TransactionStatus Status { get; set; } = TransactionStatus.Created;

    /// <summary>UPI, Credit Card, Debit Card, Net Banking, Wallet — as reported by the gateway.</summary>
    [StringLength(50)]
    public string? PaymentMethod { get; set; }

    [StringLength(500)]
    public string? FailureReason { get; set; }

    [StringLength(300)]
    public string? PaymentUrl { get; set; }

    /// <summary>Set once the webhook signature has been verified, so a spoofed callback can't mark an order paid.</summary>
    public bool IsWebhookVerified { get; set; }

    [StringLength(4000)]
    public string? GatewayResponse { get; set; }

    public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedDate { get; set; }
}
