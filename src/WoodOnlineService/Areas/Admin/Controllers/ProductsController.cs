using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class ProductsController : AdminBaseController
{
    private const int PageSize = 20;

    private readonly ApplicationDbContext _db;
    private readonly IImageService _images;
    private readonly ILogger<ProductsController> _logger;

    public ProductsController(ApplicationDbContext db, IImageService images, ILogger<ProductsController> logger)
    {
        _db = db;
        _images = images;
        _logger = logger;
    }

    public async Task<IActionResult> Index(string? search, int? categoryId, int page = 1)
    {
        if (page < 1) page = 1;

        var query = _db.Products.Include(p => p.Category).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p => p.Name.Contains(term) || (p.WoodType != null && p.WoodType.Contains(term)));
        }

        if (categoryId is > 0)
            query = query.Where(p => p.CategoryId == categoryId);

        var total = await query.CountAsync();

        var model = new AdminListViewModel<Product>
        {
            Items = await query
                .OrderByDescending(p => p.ProductId)
                .Skip((page - 1) * PageSize)
                .Take(PageSize)
                .ToListAsync(),
            Page = page,
            PageSize = PageSize,
            TotalCount = total,
            Search = search,
            CategoryId = categoryId
        };

        ViewBag.Categories = await _db.Categories.OrderBy(c => c.DisplayOrder).ToListAsync();
        ViewData["Title"] = "Products";
        return View(model);
    }

    public async Task<IActionResult> Create()
    {
        ViewData["Title"] = "New Product";
        return View("Form", new ProductFormViewModel
        {
            IsAvailable = true,
            Categories = await LoadCategoriesAsync()
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<IActionResult> Create(ProductFormViewModel form)
    {
        if (!ModelState.IsValid)
        {
            form.Categories = await LoadCategoriesAsync();
            ViewData["Title"] = "New Product";
            return View("Form", form);
        }

        var product = new Product();
        ApplyForm(product, form);

        try
        {
            product.ImageUrl = await _images.SaveAsync(form.MainImage) ?? form.ImageUrl;
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError(nameof(form.MainImage), ex.Message);
            form.Categories = await LoadCategoriesAsync();
            ViewData["Title"] = "New Product";
            return View("Form", form);
        }

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        await SaveGalleryAsync(product.ProductId, form.GalleryImages);

        _logger.LogInformation("Product created: {Name} (#{Id})", product.Name, product.ProductId);
        TempData["Success"] = $"\"{product.Name}\" has been added.";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var product = await _db.Products
            .Include(p => p.Images.OrderBy(i => i.DisplayOrder))
            .FirstOrDefaultAsync(p => p.ProductId == id);

        if (product is null) return NotFound();

        ViewData["Title"] = $"Edit — {product.Name}";

        return View("Form", new ProductFormViewModel
        {
            ProductId = product.ProductId,
            Name = product.Name,
            CategoryId = product.CategoryId,
            WoodType = product.WoodType,
            Description = product.Description,
            Price = product.Price,
            OldPrice = product.OldPrice,
            Dimensions = product.Dimensions,
            StockQuantity = product.StockQuantity,
            IsAvailable = product.IsAvailable,
            IsFeatured = product.IsFeatured,
            IsCustomOrder = product.IsCustomOrder,
            ImageUrl = product.ImageUrl,
            ExistingImages = product.Images.ToList(),
            Categories = await LoadCategoriesAsync()
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(30 * 1024 * 1024)]
    public async Task<IActionResult> Edit(int id, ProductFormViewModel form)
    {
        var product = await _db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.ProductId == id);

        if (product is null) return NotFound();

        if (!ModelState.IsValid)
        {
            form.Categories = await LoadCategoriesAsync();
            form.ExistingImages = product.Images.ToList();
            ViewData["Title"] = $"Edit — {product.Name}";
            return View("Form", form);
        }

        ApplyForm(product, form);

        if (form.MainImage is not null)
        {
            try
            {
                var newPath = await _images.SaveAsync(form.MainImage);
                if (newPath is not null)
                {
                    // Seeded artwork is shared across products, so only delete uploads we own.
                    if (product.ImageUrl?.StartsWith("/uploads/") == true && !IsSeedImage(product.ImageUrl))
                        _images.Delete(product.ImageUrl);

                    product.ImageUrl = newPath;
                }
            }
            catch (InvalidOperationException ex)
            {
                ModelState.AddModelError(nameof(form.MainImage), ex.Message);
                form.Categories = await LoadCategoriesAsync();
                form.ExistingImages = product.Images.ToList();
                ViewData["Title"] = $"Edit — {product.Name}";
                return View("Form", form);
            }
        }

        await _db.SaveChangesAsync();
        await SaveGalleryAsync(product.ProductId, form.GalleryImages);

        _logger.LogInformation("Product updated: {Name} (#{Id})", product.Name, product.ProductId);
        TempData["Success"] = $"\"{product.Name}\" has been updated.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await _db.Products
            .Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.ProductId == id);

        if (product is null) return NotFound();

        // Order history references products, so a sold product is hidden rather than removed.
        var isOrdered = await _db.OrderItems.AnyAsync(oi => oi.ProductId == id);
        if (isOrdered)
        {
            product.IsAvailable = false;
            await _db.SaveChangesAsync();

            TempData["Success"] = $"\"{product.Name}\" has existing orders, so it has been hidden instead of deleted.";
            return RedirectToAction(nameof(Index));
        }

        foreach (var img in product.Images)
        {
            if (!IsSeedImage(img.ImagePath)) _images.Delete(img.ImagePath);
        }

        if (product.ImageUrl is not null && !IsSeedImage(product.ImageUrl))
            _images.Delete(product.ImageUrl);

        var cartRows = await _db.CartItems.Where(c => c.ProductId == id).ToListAsync();
        _db.CartItems.RemoveRange(cartRows);

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Product deleted: {Name} (#{Id})", product.Name, id);
        TempData["Success"] = $"\"{product.Name}\" has been deleted.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DeleteImage(int imageId)
    {
        var image = await _db.ProductImages.FindAsync(imageId);
        if (image is null) return NotFound();

        var productId = image.ProductId;

        if (!IsSeedImage(image.ImagePath)) _images.Delete(image.ImagePath);

        _db.ProductImages.Remove(image);
        await _db.SaveChangesAsync();

        TempData["Success"] = "Image removed.";
        return RedirectToAction(nameof(Edit), new { id = productId });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ToggleFeatured(int id)
    {
        var product = await _db.Products.FindAsync(id);
        if (product is null) return NotFound();

        product.IsFeatured = !product.IsFeatured;
        await _db.SaveChangesAsync();

        TempData["Success"] = product.IsFeatured
            ? $"\"{product.Name}\" will now appear on the homepage."
            : $"\"{product.Name}\" has been removed from the homepage.";

        return RedirectToAction(nameof(Index));
    }

    private static void ApplyForm(Product product, ProductFormViewModel form)
    {
        product.Name = form.Name.Trim();
        product.CategoryId = form.CategoryId;
        product.WoodType = form.WoodType?.Trim();
        product.Description = form.Description?.Trim();
        product.Dimensions = form.Dimensions?.Trim();
        product.IsAvailable = form.IsAvailable;
        product.IsFeatured = form.IsFeatured;
        product.IsCustomOrder = form.IsCustomOrder;

        // Custom-order items are quoted individually, so any price or stock typed in is meaningless.
        if (form.IsCustomOrder)
        {
            product.Price = 0;
            product.OldPrice = null;
            product.StockQuantity = 0;
        }
        else
        {
            product.Price = form.Price;
            product.OldPrice = form.OldPrice is > 0 ? form.OldPrice : null;
            product.StockQuantity = form.StockQuantity;
        }
    }

    private async Task SaveGalleryAsync(int productId, List<IFormFile>? files)
    {
        if (files is null || files.Count == 0) return;

        var nextOrder = await _db.ProductImages
            .Where(i => i.ProductId == productId)
            .MaxAsync(i => (int?)i.DisplayOrder) ?? 0;

        foreach (var file in files.Where(f => f.Length > 0))
        {
            try
            {
                var path = await _images.SaveAsync(file);
                if (path is null) continue;

                _db.ProductImages.Add(new ProductImage
                {
                    ProductId = productId,
                    ImagePath = path,
                    DisplayOrder = ++nextOrder
                });
            }
            catch (InvalidOperationException ex)
            {
                // One bad file shouldn't discard the rest of the upload.
                _logger.LogWarning("Gallery image skipped: {Message}", ex.Message);
                TempData["Error"] = ex.Message;
            }
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>Seeded artwork ships with the app and is reused, so it must survive product deletes.</summary>
    private static bool IsSeedImage(string path) =>
        path.StartsWith("/uploads/products/", StringComparison.OrdinalIgnoreCase) &&
        path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase) &&
        !Path.GetFileNameWithoutExtension(path).All(c => Uri.IsHexDigit(c));

    private async Task<List<Category>> LoadCategoriesAsync() =>
        await _db.Categories.OrderBy(c => c.DisplayOrder).ToListAsync();
}
