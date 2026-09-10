namespace WoodOnlineService.Services;

public interface IImageService
{
    Task<string?> SaveAsync(IFormFile? file, string subFolder = "products");
    void Delete(string? relativePath);
}

public class ImageService : IImageService
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
    private const long MaxBytes = 5 * 1024 * 1024;

    private readonly IWebHostEnvironment _env;
    private readonly ILogger<ImageService> _logger;

    public ImageService(IWebHostEnvironment env, ILogger<ImageService> logger)
    {
        _env = env;
        _logger = logger;
    }

    public async Task<string?> SaveAsync(IFormFile? file, string subFolder = "products")
    {
        if (file is null || file.Length == 0) return null;

        if (file.Length > MaxBytes)
            throw new InvalidOperationException("Image must be smaller than 5 MB.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(ext))
            throw new InvalidOperationException("Only JPG, PNG, WEBP, GIF or SVG images can be uploaded.");

        // Never trust the client filename — generate our own and keep only the vetted extension.
        var fileName = $"{Guid.NewGuid():N}{ext}";
        var folder = Path.Combine(_env.WebRootPath, "uploads", subFolder);
        Directory.CreateDirectory(folder);

        var fullPath = Path.Combine(folder, fileName);
        await using (var stream = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"/uploads/{subFolder}/{fileName}";
    }

    public void Delete(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;

        // Only ever delete inside wwwroot/uploads, whatever the stored value claims.
        if (!relativePath.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)) return;

        try
        {
            var uploadsRoot = Path.GetFullPath(Path.Combine(_env.WebRootPath, "uploads"));
            var target = Path.GetFullPath(Path.Combine(_env.WebRootPath, relativePath.TrimStart('/')));

            if (!target.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase)) return;
            if (File.Exists(target)) File.Delete(target);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete image: {Path}", relativePath);
        }
    }
}
