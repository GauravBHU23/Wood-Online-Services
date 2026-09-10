using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WoodOnlineService.Data;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public record ChatReply(string Message, List<string> Suggestions, List<ChatProduct>? Products = null);

public record ChatProduct(int Id, string Name, decimal Price, bool IsCustomOrder, string? Image, string? WoodType);

public interface IChatbotService
{
    Task<ChatReply> AnswerAsync(string question, CancellationToken ct = default);
    ChatReply Greeting();
}

/// <summary>
/// Answers customer questions from the shop's own data - real prices, real stock, real contact
/// details - rather than canned marketing text. Intent is matched on keywords, so it works
/// offline and costs nothing to run.
///
/// It deliberately never invents an answer: anything it does not recognise is handed off to
/// WhatsApp or the phone number so a person picks it up.
/// </summary>
public class ChatbotService : IChatbotService
{
    private readonly ApplicationDbContext _db;
    private readonly SiteSettings _site;

    public ChatbotService(ApplicationDbContext db, IOptions<SiteSettings> site)
    {
        _db = db;
        _site = site.Value;
    }

    private static readonly string[] DefaultSuggestions =
    [
        "What do you sell?",
        "Show me prices",
        "Where is your shop?",
        "Do you deliver?",
        "How do I order?"
    ];

    public ChatReply Greeting() => new(
        $"Hello! Welcome to {_site.ShopName}. Ask me about our furniture, prices, delivery or how to order.",
        DefaultSuggestions.ToList());

    public async Task<ChatReply> AnswerAsync(string question, CancellationToken ct = default)
    {
        var q = (question ?? string.Empty).Trim().ToLowerInvariant();

        if (q.Length == 0) return Greeting();

        // Cap the input so a huge string cannot be used to make the database work hard.
        if (q.Length > 200) q = q[..200];

        if (Matches(q, "hi", "hello", "hey", "namaste", "good morning", "good evening"))
            return Greeting();

        if (Matches(q, "address", "where", "location", "shop", "reach", "direction", "map"))
            return Location();

        if (Matches(q, "phone", "call", "contact", "number", "whatsapp", "email"))
            return Contact();

        if (Matches(q, "time", "timing", "hour", "open", "close", "when"))
            return Hours();

        if (Matches(q, "deliver", "shipping", "courier", "transport", "charge"))
            return Delivery();

        if (Matches(q, "pay", "payment", "upi", "card", "cod", "cash", "online"))
            return Payment();

        if (Matches(q, "order", "buy", "purchase", "how do i", "how to"))
            return HowToOrder();

        if (Matches(q, "custom", "measurement", "size", "made to", "design", "quote", "quotation"))
            return CustomWork();

        if (Matches(q, "wood", "material", "sheesham", "teak", "mango", "pine", "quality", "termite"))
            return await WoodTypesAsync(ct);

        if (Matches(q, "warranty", "guarantee", "return", "refund", "cancel", "damage"))
            return Warranty();

        if (Matches(q, "price", "cost", "rate", "cheap", "budget", "how much"))
            return await PricingAsync(ct);

        // Anything else: try the catalogue before giving up.
        var found = await SearchProductsAsync(q, ct);
        if (found.Count > 0)
        {
            return new ChatReply(
                $"I found {found.Count} item{(found.Count == 1 ? "" : "s")} matching that:",
                ["Show me prices", "Do you deliver?", "How do I order?"],
                found);
        }

        return Unknown();
    }

    // ------------------------------------------------------------------ answers

    private ChatReply Location() => new(
        $"Our shop is at:\n\n{_site.AddressLine1}\n{_site.AddressLine2}\n\n" +
        $"Open {_site.WorkingHours}. Do come and see the wood in person - a photograph never " +
        "shows the real grain.",
        ["What are your timings?", "What is your phone number?", "Do you deliver?"]);

    private ChatReply Contact() => new(
        $"You can reach us here:\n\n" +
        $"Phone: {_site.Phone}\n" +
        $"WhatsApp: {_site.Phone}\n" +
        $"Email: {_site.Email}\n\n" +
        $"We are available {_site.WorkingHours}.",
        ["Where is your shop?", "What are your timings?", "How do I order?"]);

    private ChatReply Hours() => new(
        $"We are open {_site.WorkingHours}.\n\nYou can browse and order on the website at any " +
        "time; we will call you to confirm during shop hours.",
        ["Where is your shop?", "How do I order?", "Do you deliver?"]);

    private ChatReply Delivery() => new(
        $"Yes, we deliver to your home.\n\n" +
        $"Delivery is free on orders of Rs. {_site.FreeShippingAbove:N0} and above. " +
        $"Below that a charge of Rs. {_site.ShippingCharge:N0} applies.\n\n" +
        "Ready-stock items usually arrive in 3 to 7 working days. Made-to-order pieces take " +
        "longer, and we agree the timeline with you before starting. We assemble the furniture " +
        "at your home.",
        ["How do I order?", "What payment methods do you take?", "Where is your shop?"]);

    private ChatReply Payment() => new(
        "You can pay either way:\n\n" +
        "Online - UPI, credit card, debit card, net banking or a wallet. Payment is handled on a " +
        "secure gateway; we never see your card details.\n\n" +
        "Cash on Delivery - pay when the furniture reaches your home. For large orders we call to " +
        "confirm first.",
        ["How do I order?", "Do you deliver?", "Can I cancel an order?"]);

    private ChatReply HowToOrder() => new(
        "Ordering is straightforward:\n\n" +
        "1. Browse the products and add what you like to your cart\n" +
        "2. Create an account or sign in\n" +
        "3. Enter your delivery address\n" +
        "4. Pay online, or choose Cash on Delivery\n\n" +
        "We then call you to confirm, and you can track the order from your account.\n\n" +
        $"Prefer to talk? Call {_site.Phone}.",
        ["Do you deliver?", "What payment methods do you take?", "Can I get custom sizes?"]);

    private ChatReply CustomWork() => new(
        "Yes, we make furniture to your own measurements.\n\n" +
        "Tell us the size, the design you have in mind and which wood you prefer, and we will " +
        "prepare a quotation. A photograph or a rough sketch helps.\n\n" +
        "Temples, main doors and fitted units are almost always made to order, which is why they " +
        "show 'Price on request' rather than a fixed price.\n\n" +
        $"Send the details on WhatsApp at {_site.Phone} and we will come back with a price.",
        ["What woods do you use?", "How long does it take?", "Where is your shop?"]);

    private async Task<ChatReply> WoodTypesAsync(CancellationToken ct)
    {
        var woods = await _db.Products
            .AsNoTracking()
            .Where(p => p.IsAvailable && p.WoodType != null && p.WoodType != "")
            .Select(p => p.WoodType!)
            .Distinct()
            .OrderBy(w => w)
            .ToListAsync(ct);

        var list = woods.Count > 0 ? string.Join(", ", woods) : "Sheesham, Teak, Mango Wood and Pine";

        return new ChatReply(
            $"We work in {list}.\n\n" +
            "Everything is solid wood - the same timber inside and out, with no particle board or " +
            "plywood filling. The timber is seasoned first so it will not crack or warp, then " +
            "termite treated. Joints are cut mortise-and-tenon by hand rather than relying on " +
            "nails and glue.\n\n" +
            "Polish is your choice: natural, walnut or mahogany.",
            ["Show me prices", "Can I get custom sizes?", "Is there a warranty?"]);
    }

    private ChatReply Warranty() => new(
        "We warrant our joinery and workmanship for 12 months from delivery.\n\n" +
        "Please check the furniture at the time of delivery. If anything arrived damaged, tell us " +
        "within 48 hours with photographs and we will repair or replace it.\n\n" +
        "You can cancel an order from your account until it has been dispatched. Made-to-order " +
        "pieces cannot be cancelled once work has started, because they cannot be resold.\n\n" +
        $"Any problem at all, call {_site.Phone}.",
        ["Do you deliver?", "How do I order?", "What is your address?"]);

    private async Task<ChatReply> PricingAsync(CancellationToken ct)
    {
        var priced = await _db.Products
            .AsNoTracking()
            .Where(p => p.IsAvailable && !p.IsCustomOrder && p.Price > 0)
            .ToListAsync(ct);

        if (priced.Count == 0)
        {
            return new ChatReply(
                $"Please call {_site.Phone} and we will share current prices.",
                DefaultSuggestions.ToList());
        }

        // Ordered in memory: SQLite cannot ORDER BY a decimal column.
        var cheapest = priced.OrderBy(p => p.Price).Take(4).ToList();
        var lowest = priced.Min(p => p.Price);
        var highest = priced.Max(p => p.Price);

        return new ChatReply(
            $"Our furniture ranges from Rs. {lowest:N0} to Rs. {highest:N0}, depending on the " +
            "wood and the size.\n\nSome of our more affordable pieces:",
            ["Do you deliver?", "Can I get custom sizes?", "How do I order?"],
            cheapest.Select(ToChatProduct).ToList());
    }

    private async Task<List<ChatProduct>> SearchProductsAsync(string term, CancellationToken ct)
    {
        // Strip filler words so "do you have a dining table" still finds "dining table".
        var stop = new[] { "do", "you", "have", "any", "the", "a", "an", "is", "are", "for",
                           "me", "show", "i", "want", "need", "looking", "got", "there", "your" };

        var words = term
            .Split([' ', ',', '.', '?', '!'], StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 2 && !stop.Contains(w))
            .Take(4)
            .ToList();

        if (words.Count == 0) return [];

        var query = _db.Products.AsNoTracking().Where(p => p.IsAvailable);

        // Every word must appear somewhere, so "teak bed" does not match every bed.
        foreach (var word in words)
        {
            var w = word;
            query = query.Where(p =>
                p.Name.Contains(w) ||
                (p.WoodType != null && p.WoodType.Contains(w)) ||
                (p.Category != null && p.Category.Name.Contains(w)) ||
                (p.Description != null && p.Description.Contains(w)));
        }

        var matches = await query.Take(4).ToListAsync(ct);
        return matches.Select(ToChatProduct).ToList();
    }

    private ChatReply Unknown() => new(
        "I am not sure about that one, and I would rather not guess.\n\n" +
        $"Please message us on WhatsApp at {_site.Phone} or call the same number - " +
        $"we are available {_site.WorkingHours} and will answer properly.",
        ["What do you sell?", "Where is your shop?", "Do you deliver?", "How do I order?"]);

    private static ChatProduct ToChatProduct(Product p) =>
        new(p.ProductId, p.Name, p.Price, p.IsCustomOrder, p.ImageUrl, p.WoodType);

    private static bool Matches(string question, params string[] keywords) =>
        keywords.Any(question.Contains);
}
