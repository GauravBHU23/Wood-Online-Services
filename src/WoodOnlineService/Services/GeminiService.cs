using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public interface IGeminiService
{
    bool IsEnabled { get; }

    /// <summary>
    /// Asks Gemini to phrase a reply using only the given system instruction and user message.
    /// Returns null on any failure (network, quota, malformed response) so the caller can fall
    /// back to a canned answer — the chatbot must never go silent just because the AI call failed.
    /// </summary>
    Task<string?> GenerateAsync(string systemInstruction, string userMessage, CancellationToken ct = default);
}

/// <summary>
/// Thin wrapper over the Gemini free-tier REST API. Used only to phrase natural-language
/// responses around facts the caller already looked up from the database — it is never given
/// free rein to invent prices, stock, or policy, because the system instruction it is called
/// with explicitly restricts it to the supplied facts.
/// </summary>
public class GeminiService : IGeminiService
{
    private readonly HttpClient _http;
    private readonly GeminiSettings _settings;
    private readonly ILogger<GeminiService> _logger;

    public GeminiService(HttpClient http, IOptions<GeminiSettings> settings, ILogger<GeminiService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        _http = http;
        // No BaseAddress: the model name contains a colon ("model:generateContent"), which
        // .NET's relative-URI resolution misreads as a URI scheme. The full absolute URL is
        // built by hand in GenerateAsync instead.
        _http.Timeout = TimeSpan.FromSeconds(12);
    }

    public bool IsEnabled => _settings.IsConfigured;

    public async Task<string?> GenerateAsync(string systemInstruction, string userMessage, CancellationToken ct = default)
    {
        if (!IsEnabled) return null;

        var payload = new
        {
            system_instruction = new { parts = new[] { new { text = systemInstruction } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = userMessage } } } },
            generationConfig = new { temperature = 0.3, maxOutputTokens = 400 }
        };

        try
        {
            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            // Built by hand as a full string rather than via new Uri(base, relative) or
            // HttpClient's relative-path overload: .NET's parser treats anything before the
            // first colon as a URI scheme per RFC 3986 ("gemini-3.5-flash-lite:generateContent"
            // reads as scheme "gemini-3.5-flash-lite"), and throws NotSupportedException instead
            // of resolving it against BaseAddress — a leading "./" doesn't change that reading.
            var url = new Uri(
                _settings.BaseUrl.TrimEnd('/') + "/" +
                $"{_settings.Model}:generateContent?key={Uri.EscapeDataString(_settings.ApiKey)}");

            using var response = await _http.PostAsync(url, content, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini request failed with {Status}: {Body}",
                    response.StatusCode, Truncate(body, 500));
                return null;
            }

            using var doc = JsonDocument.Parse(body);

            var text = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini call threw; falling back to the canned reply.");
            return null;
        }
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
