using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Models;

namespace WoodOnlineService.Data;

public static class Roles
{
    public const string Admin = "Admin";
    public const string Customer = "Customer";
}

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        // The committed migrations are SQL Server specific, so on SQLite the schema is
        // created straight from the model instead. Production always takes the migration path.
        if (db.Database.IsSqlite())
        {
            await db.Database.EnsureCreatedAsync();
            logger.LogInformation("SQLite development database ready.");
        }
        else
        {
            await db.Database.MigrateAsync();
        }

        foreach (var role in new[] { Roles.Admin, Roles.Customer })
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        await SeedAdminAsync(userManager, config, logger);

        if (!await db.Categories.AnyAsync())
        {
            db.Categories.AddRange(BuildCategories());
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded categories.");
        }

        if (!await db.Products.AnyAsync())
        {
            var byName = await db.Categories.ToDictionaryAsync(c => c.Name, c => c.CategoryId);
            db.Products.AddRange(BuildProducts(byName));
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded products.");
        }
        else
        {
            await RefreshSeededCopyAsync(db, logger);
        }
    }

    /// <summary>
    /// Brings seeded catalogue text in line with the current seed data.
    ///
    /// The seed only runs into an empty table, so wording fixes would otherwise never reach a
    /// database that was populated earlier. Only untouched seed rows are updated: a product
    /// whose description the shop has edited is left exactly as the shop wrote it.
    /// </summary>
    private static async Task RefreshSeededCopyAsync(ApplicationDbContext db, ILogger logger)
    {
        var updated = 0;

        var categories = await db.Categories.ToListAsync();
        foreach (var seeded in BuildCategories())
        {
            var existing = categories.FirstOrDefault(c => c.Name == seeded.Name);
            if (existing is null || existing.Description == seeded.Description) continue;

            existing.Description = seeded.Description;
            updated++;
        }

        var byName = await db.Categories.ToDictionaryAsync(c => c.Name, c => c.CategoryId);
        var products = await db.Products.ToListAsync();

        foreach (var seeded in BuildProducts(byName))
        {
            var existing = products.FirstOrDefault(p => p.Name == seeded.Name);
            if (existing is null || existing.Description == seeded.Description) continue;

            existing.Description = seeded.Description;
            updated++;
        }

        if (updated == 0) return;

        await db.SaveChangesAsync();
        logger.LogInformation("Refreshed {Count} seeded description(s).", updated);
    }

    private static async Task SeedAdminAsync(UserManager<ApplicationUser> userManager, IConfiguration config, ILogger logger)
    {
        var email = config["AdminUser:Email"] ?? "admin@woodonline.local";
        var password = config["AdminUser:Password"];

        // A weak, well-known fallback password would defeat the point of requiring one. If the
        // deployment forgot to set AdminUser:Password, generate a random one instead of ever
        // creating an account with a guessable password — and log it once so it can be captured.
        var generated = string.IsNullOrWhiteSpace(password);
        if (generated)
            password = "Wd!" + Guid.NewGuid().ToString("N")[..20] + "9a";

        var admin = await userManager.FindByEmailAsync(email);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                FullName = config["AdminUser:FullName"] ?? "Shop Admin",
                // The account must always change out of its very first password before it can
                // do anything else, so a default or generated password can never persist.
                MustChangePassword = true
            };

            var result = await userManager.CreateAsync(admin, password!);
            if (!result.Succeeded)
            {
                logger.LogError("Failed to create the admin user: {Errors}",
                    string.Join("; ", result.Errors.Select(e => e.Description)));
                return;
            }

            if (generated)
            {
                logger.LogWarning(
                    "AdminUser:Password was not configured. A random one-time password was " +
                    "generated for {Email}: {Password} — sign in with it now and change it " +
                    "immediately; it will not be shown again.", email, password);
            }
            else
            {
                logger.LogInformation("Admin user created: {Email}. Sign in and change the password now.", email);
            }
        }

        if (!await userManager.IsInRoleAsync(admin, Roles.Admin))
            await userManager.AddToRoleAsync(admin, Roles.Admin);
    }

    private static List<Category> BuildCategories() =>
    [
        new() { Name = "Dining", Description = "Dining tables, chairs and benches - solid, well-made timber for the whole family.", ImageUrl = "/img/cat-dining.svg", DisplayOrder = 1 },
        new() { Name = "Bedroom", Description = "Beds, side tables and dressing units, all in a solid wood finish.", ImageUrl = "/img/cat-bedroom.svg", DisplayOrder = 2 },
        new() { Name = "Storage", Description = "Wardrobes, bookshelves and cabinets - what every home needs.", ImageUrl = "/img/cat-storage.svg", DisplayOrder = 3 },
        new() { Name = "Living Room", Description = "Sofa sets, coffee tables, TV units and swings.", ImageUrl = "/img/cat-living.svg", DisplayOrder = 4 },
        new() { Name = "Doors & Panels", Description = "Main doors, room doors and carved panels.", ImageUrl = "/img/cat-doors.svg", DisplayOrder = 5 },
        new() { Name = "Custom Work", Description = "Furniture made to your own measurements and design.", ImageUrl = "/img/cat-custom.svg", DisplayOrder = 6 }
    ];

    private static List<Product> BuildProducts(Dictionary<string, int> cat)
    {
        const string P = "/uploads/products/";

        return
        [
            // ---- Dining ----
            new() { Name = "6-Seater Dining Table", CategoryId = cat["Dining"], WoodType = "Sheesham", Price = 32500, OldPrice = 38000,
                Dimensions = "72\" x 36\" x 30\"", StockQuantity = 4, IsFeatured = true, ImageUrl = P + "dining-table-6-seater.svg",
                Description = "A 6-seater dining table in solid Sheesham (Indian Rosewood), made entirely by hand and finished to show the natural grain. The timber is seasoned and termite treated, so it will not crack or warp; expect 25 years and more of daily use. The top is 25mm planking and the joints are cut mortise-and-tenon, not screwed or glued." },

            new() { Name = "4-Seater Dining Table", CategoryId = cat["Dining"], WoodType = "Teak", Price = 24800, OldPrice = 28500,
                Dimensions = "48\" x 30\" x 30\"", StockQuantity = 6, ImageUrl = P + "dining-table-4-seater.svg",
                Description = "A compact 4-seater teak dining table, sized for a smaller family or a flat. It takes less room without giving up any strength, and the golden teak finish keeps its warmth for years." },

            new() { Name = "Dining Chair — Classic", CategoryId = cat["Dining"], WoodType = "Sheesham", Price = 4200, OldPrice = 4900,
                Dimensions = "18\" x 18\" x 38\"", StockQuantity = 24, IsFeatured = true, ImageUrl = P + "dining-chair-classic.svg",
                Description = "A classic dining chair with a comfortable back rest. The seat sits at the standard 18 inches, so it pairs with any dining table. Buying a set of six? Send an inquiry for a better price." },

            new() { Name = "Dining Chair — Spindle Back", CategoryId = cat["Dining"], WoodType = "Mango Wood", Price = 3400,
                Dimensions = "17\" x 17\" x 36\"", StockQuantity = 18, ImageUrl = P + "dining-chair-spindle.svg",
                Description = "A spindle-back chair in mango wood: light to move, but properly built. Traditional lines at a friendly price, and easy to live with day to day." },

            // ---- Bedroom ----
            new() { Name = "King Size Bed", CategoryId = cat["Bedroom"], WoodType = "Sheesham", Price = 46500, OldPrice = 54000,
                Dimensions = "78\" x 72\" x 40\"", StockQuantity = 3, IsFeatured = true, ImageUrl = P + "bed-king-size.svg",
                Description = "A king size bed in solid Sheesham with a carved headboard. Storage can be added underneath, either hydraulic lift or box style - mention it in your inquiry. The mattress is not included." },

            new() { Name = "Queen Size Bed", CategoryId = cat["Bedroom"], WoodType = "Teak", Price = 38900, OldPrice = 44000,
                Dimensions = "78\" x 60\" x 40\"", StockQuantity = 4, ImageUrl = P + "bed-queen-size.svg",
                Description = "A queen size teak bed with a clean, simple headboard. It suits a master bedroom or a guest room equally well. Choose your polish: natural, walnut or mahogany." },

            new() { Name = "Dressing Table with Mirror", CategoryId = cat["Bedroom"], WoodType = "Sheesham", Price = 18700, OldPrice = 21500,
                Dimensions = "36\" x 18\" x 66\"", StockQuantity = 5, ImageUrl = P + "dressing-table.svg",
                Description = "A dressing table with an oval mirror and two smooth-running drawers. The mirror has a bevelled edge and good quality silvering, so it will not cloud over with time." },

            new() { Name = "Dressing Mirror Unit", CategoryId = cat["Bedroom"], WoodType = "Teak", Price = 15200,
                Dimensions = "32\" x 16\" x 62\"", StockQuantity = 4, ImageUrl = P + "dressing-mirror-unit.svg",
                Description = "A compact dressing unit for a smaller bedroom, built on a teak frame with storage drawers. It can also be wall mounted if floor space is tight." },

            // ---- Storage ----
            new() { Name = "2-Door Wardrobe", CategoryId = cat["Storage"], WoodType = "Teak", Price = 42000, OldPrice = 48000,
                Dimensions = "48\" x 22\" x 78\"", StockQuantity = 3, IsFeatured = true, ImageUrl = P + "wardrobe-2-door.svg",
                Description = "A two-door teak wardrobe with a hanging rail, three shelves and a lockable drawer inside, finished with brass handles. We assemble it at your home." },

            new() { Name = "3-Door Wardrobe", CategoryId = cat["Storage"], WoodType = "Walnut Finish", Price = 58500, OldPrice = 66000,
                Dimensions = "72\" x 22\" x 78\"", StockQuantity = 2, ImageUrl = P + "wardrobe-3-door.svg",
                Description = "A three-door wardrobe for a larger family, with a full-length mirror on the centre door and a deep walnut finish. Inside there are two hanging sections and five shelves." },

            new() { Name = "5-Tier Bookshelf", CategoryId = cat["Storage"], WoodType = "Mango Wood", Price = 12400, OldPrice = 14500,
                Dimensions = "32\" x 12\" x 72\"", StockQuantity = 8, ImageUrl = P + "bookshelf-5-tier.svg",
                Description = "An open five-shelf bookcase for a study or living room. Each shelf carries up to 25kg, and an anti-tip wall bracket is included." },

            new() { Name = "Open Bookshelf — Compact", CategoryId = cat["Storage"], WoodType = "Pine", Price = 7900,
                Dimensions = "24\" x 11\" x 54\"", StockQuantity = 10, ImageUrl = P + "bookshelf-open.svg",
                Description = "A light pine bookshelf that fits a hostel room or sits neatly beside a small desk. Honest quality at a modest price." },

            // ---- Living Room ----
            new() { Name = "3-Seater Sofa", CategoryId = cat["Living Room"], WoodType = "Sheesham", Price = 44000, OldPrice = 51000,
                Dimensions = "78\" x 32\" x 34\"", StockQuantity = 3, IsFeatured = true, ImageUrl = P + "sofa-3-seater.svg",
                Description = "A three-seater sofa on a Sheesham frame with high-density foam cushions. Pick your fabric from twelve shades. The covers come off and can be washed." },

            new() { Name = "2-Seater Sofa", CategoryId = cat["Living Room"], WoodType = "Teak", Price = 32000, OldPrice = 36500,
                Dimensions = "54\" x 32\" x 34\"", StockQuantity = 4, ImageUrl = P + "sofa-2-seater.svg",
                Description = "A two-seater on a teak frame, sized for a smaller living room or balcony seating. Ask about the combined price if you take it with the three-seater." },

            new() { Name = "Oval Coffee Table", CategoryId = cat["Living Room"], WoodType = "Walnut Finish", Price = 11800, OldPrice = 13500,
                Dimensions = "42\" x 24\" x 18\"", StockQuantity = 7, ImageUrl = P + "coffee-table-oval.svg",
                Description = "An oval coffee table with rounded edges, which makes it safer around children, and a magazine shelf underneath. The walnut finish sits well with most sofas." },

            new() { Name = "Classic Coffee Table", CategoryId = cat["Living Room"], WoodType = "Sheesham", Price = 9600,
                Dimensions = "36\" x 20\" x 18\"", StockQuantity = 9, ImageUrl = P + "coffee-table-classic.svg",
                Description = "A plain, sturdy rectangular coffee table where the Sheesham grain shows clearly. The matte polish resists scratches from everyday use." },

            new() { Name = "Modern TV Unit", CategoryId = cat["Living Room"], WoodType = "Walnut Finish", Price = 21500, OldPrice = 25000,
                Dimensions = "60\" x 16\" x 22\"", StockQuantity = 5, IsFeatured = true, ImageUrl = P + "tv-unit-modern.svg",
                Description = "A TV unit for screens up to 55 inches, with two soft-close cabinets and cable routing at the back. There is room for a set-top box and a games console." },

            new() { Name = "TV Cabinet — Traditional", CategoryId = cat["Living Room"], WoodType = "Mango Wood", Price = 16800,
                Dimensions = "48\" x 16\" x 24\"", StockQuantity = 6, ImageUrl = P + "tv-cabinet.svg",
                Description = "A traditional TV cabinet in mango wood with brass handles and storage drawers, in a warm tone that suits older furniture." },

            new() { Name = "Wooden Jhula (Swing)", CategoryId = cat["Living Room"], WoodType = "Teak", Price = 28500, OldPrice = 33000,
                Dimensions = "60\" x 24\" x 22\" (seat)", StockQuantity = 3, IsFeatured = true, ImageUrl = P + "jhula-swing.svg",
                Description = "A teak swing for a courtyard or balcony, supplied with stainless steel chains and ceiling hooks. It holds up to 200kg, and we handle the installation." },

            new() { Name = "Classic Jhula — Carved", CategoryId = cat["Living Room"], WoodType = "Sheesham", Price = 34500,
                Dimensions = "66\" x 26\" x 24\" (seat)", StockQuantity = 2, ImageUrl = P + "jhula-classic.svg",
                Description = "A traditional swing with side panels carved by hand in a Rajasthani pattern. A piece for a sitting room or veranda." },

            // ---- Doors & Panels ----
            new() { Name = "Carved Main Door", CategoryId = cat["Doors & Panels"], WoodType = "Teak", Price = 38500, OldPrice = 45000,
                Dimensions = "36\" x 84\" (standard)", StockQuantity = 2, IsFeatured = true, ImageUrl = P + "main-door-carved.svg",
                Description = "A carved teak main door supplied complete with its frame. It is made to your measurements, so please confirm the opening before ordering. Fittings - hinges, handle and lock - are separate." },

            new() { Name = "Plain Panel Door", CategoryId = cat["Doors & Panels"], WoodType = "Sheesham", Price = 14200,
                Dimensions = "32\" x 80\" (standard)", StockQuantity = 6, ImageUrl = P + "door-panel-plain.svg",
                Description = "A simple panel door for rooms inside the house, in solid Sheesham with no plywood filling. A water-resistant polish is available for bathroom use." },

            // ---- Custom Work (quote-only) ----
            new() { Name = "Wooden Mandir / Temple", CategoryId = cat["Custom Work"], WoodType = "Teak", Price = 0, IsCustomOrder = true,
                Dimensions = "Made to your measurements", StockQuantity = 0, IsFeatured = true, ImageUrl = P + "mandir-temple.svg",
                Description = "A teak home temple made by hand, with a dome, carved pillars and storage drawers. Size, design and the amount of carving are entirely your choice, and the price follows from them - send an inquiry and we will prepare a quotation." },

            new() { Name = "Wall-Mount Mandir", CategoryId = cat["Custom Work"], WoodType = "Sheesham", Price = 0, IsCustomOrder = true,
                Dimensions = "Made to your measurements", StockQuantity = 0, ImageUrl = P + "mandir-wall-mount.svg",
                Description = "A wall-mounted temple for a flat or a smaller space. It takes almost no floor room while keeping the traditional look. Send us the measurements and we will share a design and price." },

            new() { Name = "Custom Study Table", CategoryId = cat["Custom Work"], WoodType = "Mango Wood", Price = 13500, OldPrice = 15500,
                Dimensions = "48\" x 24\" x 30\"", StockQuantity = 5, ImageUrl = P + "study-table.svg",
                Description = "A study table with three drawers, equally suited to a child's homework or working from home. The size can be changed to fit your room, which may adjust the price." },

            new() { Name = "Office Desk", CategoryId = cat["Custom Work"], WoodType = "Walnut Finish", Price = 19800, OldPrice = 23000,
                Dimensions = "54\" x 26\" x 30\"", StockQuantity = 4, ImageUrl = P + "office-desk.svg",
                Description = "A large desk for an office or home office, with a drawer unit. A keyboard tray and cable holes can be added. Ask about the rate for five or more." }
        ];
    }
}
