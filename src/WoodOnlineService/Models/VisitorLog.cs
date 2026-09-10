using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.Models;

/// <summary>
/// One row per unique visitor session. Powers the footer visitor counter.
/// IP is stored to de-duplicate and to let an operator investigate abuse; it is never
/// shown to any visitor other than the one it belongs to.
/// </summary>
public class VisitorLog
{
    [Key]
    public long VisitorLogId { get; set; }

    [Required]
    [StringLength(64)]
    public string IpAddress { get; set; } = string.Empty;

    [StringLength(100)]
    public string? City { get; set; }

    [StringLength(100)]
    public string? Region { get; set; }

    [StringLength(100)]
    public string? Country { get; set; }

    [StringLength(10)]
    public string? CountryCode { get; set; }

    [StringLength(300)]
    public string? UserAgent { get; set; }

    [StringLength(300)]
    public string? LandingPage { get; set; }

    [StringLength(300)]
    public string? Referrer { get; set; }

    public DateTime FirstSeen { get; set; } = DateTime.UtcNow;
    public DateTime LastSeen { get; set; } = DateTime.UtcNow;

    public int PageViews { get; set; } = 1;
}

/// <summary>Running totals kept in a single row so the footer never scans the whole log table.</summary>
public class VisitorCounter
{
    [Key]
    public int VisitorCounterId { get; set; }

    public long TotalVisits { get; set; }
    public long TotalPageViews { get; set; }

    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}
