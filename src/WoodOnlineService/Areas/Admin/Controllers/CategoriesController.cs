using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WoodOnlineService.Areas.Admin.ViewModels;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;

namespace WoodOnlineService.Areas.Admin.Controllers;

public class CategoriesController : AdminBaseController
{
    private readonly ApplicationDbContext _db;
    private readonly IImageService _images;

    public CategoriesController(ApplicationDbContext db, IImageService images)
    {
        _db = db;
        _images = images;
    }

    public async Task<IActionResult> Index()
    {
        var categories = await _db.Categories
            .Include(c => c.Products)
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        ViewData["Title"] = "Categories";
        return View(categories);
    }

    public async Task<IActionResult> Create()
    {
        var nextOrder = (await _db.Categories.MaxAsync(c => (int?)c.DisplayOrder) ?? 0) + 1;

        ViewData["Title"] = "New Category";
        return View("Form", new CategoryFormViewModel { IsActive = true, DisplayOrder = nextOrder });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create(CategoryFormViewModel form)
    {
        if (!ModelState.IsValid)
        {
            ViewData["Title"] = "New Category";
            return View("Form", form);
        }

        var category = new Category
        {
            Name = form.Name.Trim(),
            Description = form.Description?.Trim(),
            DisplayOrder = form.DisplayOrder,
            IsActive = form.IsActive
        };

        try
        {
            category.ImageUrl = await _images.SaveAsync(form.Image, "categories") ?? form.ImageUrl;
        }
        catch (InvalidOperationException ex)
        {
            ModelState.AddModelError(nameof(form.Image), ex.Message);
            ViewData["Title"] = "New Category";
            return View("Form", form);
        }

        _db.Categories.Add(category);
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Category \"{category.Name}\" has been added.";
        return RedirectToAction(nameof(Index));
    }

    public async Task<IActionResult> Edit(int id)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.CategoryId == id);

        if (category is null) return NotFound();

        ViewData["Title"] = $"Edit — {category.Name}";

        return View("Form", new CategoryFormViewModel
        {
            CategoryId = category.CategoryId,
            Name = category.Name,
            Description = category.Description,
            DisplayOrder = category.DisplayOrder,
            IsActive = category.IsActive,
            ImageUrl = category.ImageUrl,
            ProductCount = category.Products.Count
        });
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Edit(int id, CategoryFormViewModel form)
    {
        var category = await _db.Categories.FindAsync(id);
        if (category is null) return NotFound();

        if (!ModelState.IsValid)
        {
            ViewData["Title"] = $"Edit — {category.Name}";
            return View("Form", form);
        }

        category.Name = form.Name.Trim();
        category.Description = form.Description?.Trim();
        category.DisplayOrder = form.DisplayOrder;
        category.IsActive = form.IsActive;

        if (form.Image is not null)
        {
            try
            {
                var newPath = await _images.SaveAsync(form.Image, "categories");
                if (newPath is not null)
                {
                    if (category.ImageUrl?.StartsWith("/uploads/categories/") == true)
                        _images.Delete(category.ImageUrl);

                    category.ImageUrl = newPath;
                }
            }
            catch (InvalidOperationException ex)
            {
                ModelState.AddModelError(nameof(form.Image), ex.Message);
                ViewData["Title"] = $"Edit — {category.Name}";
                return View("Form", form);
            }
        }

        await _db.SaveChangesAsync();

        TempData["Success"] = $"Category \"{category.Name}\" has been updated.";
        return RedirectToAction(nameof(Index));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.CategoryId == id);

        if (category is null) return NotFound();

        // Products point at a category, so an occupied one can only be deactivated.
        if (category.Products.Count > 0)
        {
            TempData["Error"] = $"\"{category.Name}\" has {category.Products.Count} products. Move them to another category, or set this category inactive.";
            return RedirectToAction(nameof(Index));
        }

        if (category.ImageUrl?.StartsWith("/uploads/categories/") == true)
            _images.Delete(category.ImageUrl);

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync();

        TempData["Success"] = $"Category \"{category.Name}\" has been deleted.";
        return RedirectToAction(nameof(Index));
    }
}
