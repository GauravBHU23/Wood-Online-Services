using System.Text;
using System.Text.RegularExpressions;

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

    // SVG is XML and can carry <script>, event-handler attributes (onload=, onclick=...) or
    // external references that execute if the file is ever opened directly rather than through
    // an <img> tag. Uploads here are admin-only, but stripping these before saving means a
    // compromised admin session (or a booby-trapped file an admin was tricked into uploading)
    // can't leave live script sitting in wwwroot for anyone to trigger later.
    private static readonly Regex SvgScriptTag = new(
        @"<\s*script\b[^>]*>.*?<\s*/\s*script\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex SvgEventHandlerAttr = new(
        @"\s+on[a-z]+\s*=\s*(""[^""]*""|'[^']*'|[^\s>]*)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex SvgJavascriptUri = new(
        @"(href|xlink:href)\s*=\s*(""javascript:[^""]*""|'javascript:[^']*')", RegexOptions.IgnoreCase | RegexOptions.Compiled);

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

        if (ext == ".svg")
        {
            await SaveSanitizedSvgAsync(file, fullPath);
        }
        else
        {
            await using var stream = new FileStream(fullPath, FileMode.Create);
            await file.CopyToAsync(stream);
        }

        return $"/uploads/{subFolder}/{fileName}";
    }

    private static async Task SaveSanitizedSvgAsync(IFormFile file, string fullPath)
    {
        string content;
        using (var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8))
        {
            content = await reader.ReadToEndAsync();
        }

        content = SvgScriptTag.Replace(content, string.Empty);
        content = SvgEventHandlerAttr.Replace(content, string.Empty);
        content = SvgJavascriptUri.Replace(content, string.Empty);

        await File.WriteAllTextAsync(fullPath, content, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
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
