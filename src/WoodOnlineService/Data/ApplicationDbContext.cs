using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Models;

namespace WoodOnlineService.Data;

/// <summary>
/// Also stores the Data Protection key ring so auth cookies and antiforgery tokens
/// survive an Azure App Service restart or a scale-out to multiple instances.
/// </summary>
public class ApplicationDbContext : IdentityDbContext<ApplicationUser>, IDataProtectionKeyContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<Inquiry> Inquiries => Set<Inquiry>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ReviewVote> ReviewVotes => Set<ReviewVote>();
    public DbSet<SiteFeedback> SiteFeedbacks => Set<SiteFeedback>();
    public DbSet<AdminLoginOtp> AdminLoginOtps => Set<AdminLoginOtp>();
    public DbSet<VisitorLog> VisitorLogs => Set<VisitorLog>();
    public DbSet<VisitorCounter> VisitorCounters => Set<VisitorCounter>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Product>(e =>
        {
            e.HasOne(p => p.Category)
             .WithMany(c => c.Products)
             .HasForeignKey(p => p.CategoryId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(p => p.CategoryId);
            e.HasIndex(p => p.IsFeatured);
        });

        builder.Entity<ProductImage>()
            .HasOne(i => i.Product)
            .WithMany(p => p.Images)
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // An inquiry outlives the product it was about, so keep it and null the link instead.
        builder.Entity<Inquiry>(e =>
        {
            e.HasOne(i => i.Product)
             .WithMany()
             .HasForeignKey(i => i.ProductId)
             .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(i => i.Status);
            e.HasIndex(i => i.CreatedDate);
        });

        builder.Entity<Order>(e =>
        {
            e.HasOne(o => o.User)
             .WithMany()
             .HasForeignKey(o => o.UserId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(o => o.OrderNumber).IsUnique();
            e.HasIndex(o => o.UserId);
            e.HasIndex(o => o.OrderStatus);
        });

        builder.Entity<OrderItem>(e =>
        {
            e.HasOne(oi => oi.Order)
             .WithMany(o => o.Items)
             .HasForeignKey(oi => oi.OrderId)
             .OnDelete(DeleteBehavior.Cascade);

            // Products must stay deletable, and the item keeps its own name/price snapshot.
            e.HasOne(oi => oi.Product)
             .WithMany()
             .HasForeignKey(oi => oi.ProductId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<CartItem>(e =>
        {
            e.HasOne(c => c.Product)
             .WithMany()
             .HasForeignKey(c => c.ProductId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(c => c.CartKey);
            e.HasIndex(c => new { c.CartKey, c.ProductId }).IsUnique();
        });

        builder.Entity<Review>(e =>
        {
            e.HasOne(r => r.Product)
             .WithMany(p => p.Reviews)
             .HasForeignKey(r => r.ProductId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.User)
             .WithMany()
             .HasForeignKey(r => r.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // One review per customer per product; editing replaces the existing one.
            e.HasIndex(r => new { r.ProductId, r.UserId }).IsUnique();
            e.HasIndex(r => r.Status);
            e.HasIndex(r => r.CreatedDate);
        });

        builder.Entity<ReviewVote>(e =>
        {
            e.HasOne(v => v.Review)
             .WithMany()
             .HasForeignKey(v => v.ReviewId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(v => new { v.ReviewId, v.UserId }).IsUnique();
        });

        builder.Entity<VisitorLog>(e =>
        {
            e.HasIndex(v => v.IpAddress);
            e.HasIndex(v => v.FirstSeen);
        });

        builder.Entity<PaymentTransaction>(e =>
        {
            e.HasOne(p => p.Order)
             .WithMany()
             .HasForeignKey(p => p.OrderId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(p => p.PaymentRequestId);
            e.HasIndex(p => p.PaymentId);
            e.HasIndex(p => p.Status);
        });

        // Product search runs over these columns on every listing page.
        builder.Entity<Product>(e =>
        {
            e.HasIndex(p => p.Name);
            e.HasIndex(p => new { p.IsAvailable, p.CategoryId });
            e.HasIndex(p => p.AverageRating);
        });
    }
}
