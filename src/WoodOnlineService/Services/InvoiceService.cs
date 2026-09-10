using Microsoft.Extensions.Options;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

/// <summary>Everything the printed bill needs, worked out once so the view stays declarative.</summary>
public record InvoiceModel(
    Order Order,
    string InvoiceNumber,
    DateTime InvoiceDate,
    decimal TaxableValue,
    decimal CgstAmount,
    decimal SgstAmount,
    decimal IgstAmount,
    decimal TotalTax,
    decimal ShippingCharge,
    decimal GrandTotal,
    decimal RoundOff,
    string AmountInWords,
    bool IsInterState,
    bool HasGst,
    decimal GstRate);

public interface IInvoiceService
{
    InvoiceModel Build(Order order);
}

public class InvoiceService : IInvoiceService
{
    private readonly SiteSettings _site;

    public InvoiceService(IOptions<SiteSettings> site) => _site = site.Value;

    public InvoiceModel Build(Order order)
    {
        var hasGst = !string.IsNullOrWhiteSpace(_site.GstNumber) && _site.GstRate > 0;
        var rate = hasGst ? _site.GstRate : 0m;

        // A buyer outside the shop's own state pays IGST instead of CGST + SGST.
        var isInterState = hasGst && !string.Equals(
            order.ShippingState?.Trim(), _site.StateName?.Trim(), StringComparison.OrdinalIgnoreCase);

        // Goods only. Delivery is billed separately below so the taxable value matches the items.
        var goodsTotal = order.Items.Sum(i => i.LineTotal);

        decimal taxableValue, totalTax;

        if (!hasGst)
        {
            taxableValue = goodsTotal;
            totalTax = 0m;
        }
        else if (_site.PricesIncludeGst)
        {
            // Listed prices already contain the tax, so extract it rather than adding it on.
            taxableValue = Math.Round(goodsTotal * 100m / (100m + rate), 2);
            totalTax = Math.Round(goodsTotal - taxableValue, 2);
        }
        else
        {
            taxableValue = goodsTotal;
            totalTax = Math.Round(goodsTotal * rate / 100m, 2);
        }

        var cgst = isInterState ? 0m : Math.Round(totalTax / 2m, 2);
        var sgst = isInterState ? 0m : totalTax - cgst;   // absorbs the rounding remainder
        var igst = isInterState ? totalTax : 0m;

        // The order total is what the customer actually agreed to pay; the invoice must match it.
        var payable = order.TotalAmount;
        var rounded = Math.Round(payable, 0, MidpointRounding.AwayFromZero);
        var roundOff = rounded - payable;

        return new InvoiceModel(
            Order: order,
            InvoiceNumber: BuildInvoiceNumber(order),
            InvoiceDate: order.OrderDate,
            TaxableValue: taxableValue,
            CgstAmount: cgst,
            SgstAmount: sgst,
            IgstAmount: igst,
            TotalTax: totalTax,
            ShippingCharge: order.ShippingCharge,
            GrandTotal: rounded,
            RoundOff: roundOff,
            AmountInWords: ToIndianWords(rounded),
            IsInterState: isInterState,
            HasGst: hasGst,
            GstRate: rate);
    }

    /// <summary>
    /// Derives the invoice number from the order number, so the same order always produces the
    /// same invoice number no matter how many times the bill is reprinted.
    /// WOS-20260908-0007 becomes INV-2026-0007.
    /// </summary>
    private string BuildInvoiceNumber(Order order)
    {
        var prefix = string.IsNullOrWhiteSpace(_site.InvoicePrefix) ? "INV" : _site.InvoicePrefix.Trim();
        var parts = order.OrderNumber.Split('-');

        if (parts.Length == 3 && parts[1].Length >= 4)
            return $"{prefix}-{parts[1][..4]}-{parts[2]}";

        return $"{prefix}-{order.OrderDate:yyyy}-{order.OrderId:D4}";
    }

    // ------------------------------------------------------------------ words

    private static readonly string[] Ones =
    [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
        "Eighteen", "Nineteen"
    ];

    private static readonly string[] Tens =
    [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ];

    /// <summary>
    /// Renders an amount the way an Indian invoice does — lakh and crore, not million.
    /// A bill is a legal document, so the words are the authority if the figures are disputed.
    /// </summary>
    public static string ToIndianWords(decimal amount)
    {
        if (amount <= 0) return "Zero Rupees Only";

        var rupees = (long)Math.Floor(amount);
        var paise = (int)Math.Round((amount - rupees) * 100m, MidpointRounding.AwayFromZero);

        var words = rupees == 0 ? "Zero" : GroupToWords(rupees);
        var text = $"{words} Rupees";

        if (paise > 0) text += $" and {GroupToWords(paise)} Paise";

        return text + " Only";
    }

    private static string GroupToWords(long number)
    {
        if (number == 0) return string.Empty;

        var parts = new List<string>();

        // Indian grouping: crore, lakh, thousand, then the last three digits.
        var crore = number / 10_000_000;
        if (crore > 0)
        {
            parts.Add($"{GroupToWords(crore)} Crore");
            number %= 10_000_000;
        }

        var lakh = number / 100_000;
        if (lakh > 0)
        {
            parts.Add($"{UpToNinetyNine(lakh)} Lakh");
            number %= 100_000;
        }

        var thousand = number / 1_000;
        if (thousand > 0)
        {
            parts.Add($"{UpToNinetyNine(thousand)} Thousand");
            number %= 1_000;
        }

        var hundred = number / 100;
        if (hundred > 0)
        {
            parts.Add($"{Ones[hundred]} Hundred");
            number %= 100;
        }

        if (number > 0)
        {
            if (parts.Count > 0) parts.Add("and");
            parts.Add(UpToNinetyNine(number));
        }

        return string.Join(" ", parts);
    }

    private static string UpToNinetyNine(long n)
    {
        if (n < 20) return Ones[n];

        var tens = Tens[n / 10];
        var ones = n % 10;

        return ones == 0 ? tens : $"{tens} {Ones[ones]}";
    }
}
