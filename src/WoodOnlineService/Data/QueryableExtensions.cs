using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Models;

namespace WoodOnlineService.Data;

/// <summary>
/// SQLite has no native decimal type and refuses to ORDER BY one, while SQL Server orders
/// decimals natively and would lose precision if everything were cast to double.
/// These helpers pick the right expression for whichever provider the context is using.
/// </summary>
public static class QueryableExtensions
{
    public static IOrderedQueryable<Product> OrderByPrice(
        this IQueryable<Product> query, bool descending, bool useSqlite)
    {
        if (useSqlite)
        {
            return descending
                ? query.OrderByDescending(p => (double)p.Price)
                : query.OrderBy(p => (double)p.Price);
        }

        return descending
            ? query.OrderByDescending(p => p.Price)
            : query.OrderBy(p => p.Price);
    }

    public static IOrderedQueryable<Product> ThenByPrice(
        this IOrderedQueryable<Product> query, bool descending, bool useSqlite)
    {
        if (useSqlite)
        {
            return descending
                ? query.ThenByDescending(p => (double)p.Price)
                : query.ThenBy(p => (double)p.Price);
        }

        return descending
            ? query.ThenByDescending(p => p.Price)
            : query.ThenBy(p => p.Price);
    }

    public static IOrderedQueryable<Product> OrderByRating(
        this IQueryable<Product> query, bool useSqlite) =>
        useSqlite
            ? query.OrderByDescending(p => (double)p.AverageRating)
            : query.OrderByDescending(p => p.AverageRating);

    public static IOrderedQueryable<Product> ThenByRating(
        this IOrderedQueryable<Product> query, bool useSqlite) =>
        useSqlite
            ? query.ThenByDescending(p => (double)p.AverageRating)
            : query.ThenByDescending(p => p.AverageRating);

    /// <summary>True when the context is running on SQLite rather than SQL Server.</summary>
    public static bool IsSqliteProvider(this DbContext context) => context.Database.IsSqlite();
}
