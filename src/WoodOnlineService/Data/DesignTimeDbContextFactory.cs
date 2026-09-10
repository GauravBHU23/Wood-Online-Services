using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace WoodOnlineService.Data;

/// <summary>
/// Used by "dotnet ef" at design time. Reads the same configuration the app uses so
/// migrations are generated for whichever provider is currently selected.
///
///   dotnet ef migrations add Name --output-dir Migrations/SqlServer
///   dotnet ef migrations add Name --output-dir Migrations/Sqlite   (with DatabaseProvider=Sqlite)
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not set.");

        var provider = configuration["DatabaseProvider"] ?? "SqlServer";
        var builder = new DbContextOptionsBuilder<ApplicationDbContext>();

        if (string.Equals(provider, "Sqlite", StringComparison.OrdinalIgnoreCase))
            builder.UseSqlite(connectionString);
        else
            builder.UseSqlServer(connectionString);

        return new ApplicationDbContext(builder.Options);
    }
}
