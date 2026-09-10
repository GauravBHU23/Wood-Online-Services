using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public interface IOrderService
{
    Task<Order> PlaceOrderAsync(HttpContext http, string userId, Order draft);
}

public class OrderService : IOrderService
{
    private readonly ApplicationDbContext _db;
    private readonly ICartService _cart;

    public OrderService(ApplicationDbContext db, ICartService cart)
    {
        _db = db;
        _cart = cart;
    }

    public async Task<Order> PlaceOrderAsync(HttpContext http, string userId, Order draft)
    {
        var cart = await _cart.GetCartAsync(http);
        if (cart.IsEmpty)
            throw new InvalidOperationException("Your cart is empty.");

        // Re-check stock at placement time — the cart may have been sitting open for a while.
        foreach (var line in cart.Lines)
        {
            if (!line.Product.InStock)
                throw new InvalidOperationException($"\"{line.Product.Name}\" is no longer in stock. Please remove it from your cart and try again.");

            if (line.Item.Quantity > line.Product.StockQuantity)
                throw new InvalidOperationException($"\"{line.Product.Name}\" has only {line.Product.StockQuantity} left in stock.");
        }

        // Azure SQL runs with a retrying execution strategy, which refuses user-initiated
        // transactions unless the whole unit is executed through the strategy itself.
        var strategy = _db.Database.CreateExecutionStrategy();
        var cartKey = _cart.GetCartKey(http);

        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            draft.UserId = userId;
            draft.OrderDate = DateTime.UtcNow;
            draft.SubTotal = cart.SubTotal;
            draft.ShippingCharge = cart.ShippingCharge;
            draft.TotalAmount = cart.Total;
            draft.OrderNumber = await GenerateOrderNumberAsync();
            draft.OrderStatus = OrderStatus.Pending;

            // Online orders stay unpaid until the gateway confirms; only COD is settled on delivery.
            draft.PaymentStatus = PaymentStatus.Pending;

            draft.Items = cart.Lines.Select(l => new OrderItem
            {
                ProductId = l.Product.ProductId,
                ProductName = l.Product.Name,
                UnitPrice = l.Product.Price,
                Quantity = l.Item.Quantity
            }).ToList();

            _db.Orders.Add(draft);

            foreach (var line in cart.Lines)
            {
                var product = await _db.Products.FindAsync(line.Product.ProductId);
                if (product is not null)
                    product.StockQuantity = Math.Max(0, product.StockQuantity - line.Item.Quantity);
            }

            await _db.SaveChangesAsync();

            var stale = await _db.CartItems.Where(c => c.CartKey == cartKey).ToListAsync();
            _db.CartItems.RemoveRange(stale);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
        });

        return draft;
    }

    private async Task<string> GenerateOrderNumberAsync()
    {
        var today = DateTime.UtcNow;
        var prefix = $"WOS-{today:yyyyMMdd}-";

        var todaysCount = await _db.Orders.CountAsync(o => o.OrderNumber.StartsWith(prefix));

        // Collisions are possible under concurrent checkout, so walk forward until the number is free.
        for (var i = todaysCount + 1; i < todaysCount + 1000; i++)
        {
            var candidate = $"{prefix}{i:D4}";
            if (!await _db.Orders.AnyAsync(o => o.OrderNumber == candidate))
                return candidate;
        }

        return $"{prefix}{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
    }
}
