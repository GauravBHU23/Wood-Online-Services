namespace WoodOnlineService.Models;

/// <summary>Shop details shown across the site. Bound from the "SiteSettings" config section.</summary>
public class SiteSettings
{
    public string ShopName { get; set; } = "Wood Online Service";
    public string Tagline { get; set; } = "Handcrafted Wooden Furniture";
    public string Phone { get; set; } = "+91 00000 00000";
    public string WhatsAppNumber { get; set; } = "910000000000";
    public string Email { get; set; } = "info@example.com";
    public string AddressLine1 { get; set; } = "Shop Address Line 1";
    public string AddressLine2 { get; set; } = "City, State - PIN";
    public string WorkingHours { get; set; } = "Mon - Sat, 10:00 AM - 8:00 PM";
    public string MapEmbedUrl { get; set; } = string.Empty;

    /// <summary>Public origin, used to build absolute links inside emails. e.g. https://woodonline.azurewebsites.net</summary>
    public string SiteBaseUrl { get; set; } = string.Empty;

    // --- Invoice / statutory details -------------------------------------------------
    // Shown on the printed bill. Leave a value empty and that line is simply omitted, so the
    // invoice stays correct for a business that is not yet GST registered.

    /// <summary>GSTIN. Empty means the shop is unregistered and no tax lines are printed.</summary>
    public string GstNumber { get; set; } = string.Empty;

    /// <summary>Combined GST rate applied to furniture, e.g. 18 for 18%.</summary>
    public decimal GstRate { get; set; }

    /// <summary>
    /// When true, listed prices already include GST and the invoice shows the tax broken out
    /// of the total. When false, tax is added on top. Indian retail almost always includes it.
    /// </summary>
    public bool PricesIncludeGst { get; set; } = true;

    /// <summary>Home state. A buyer in the same state pays CGST + SGST, otherwise IGST.</summary>
    public string StateName { get; set; } = "Bihar";

    public string StateCode { get; set; } = "10";

    public string PanNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankIfsc { get; set; } = string.Empty;
    public string UpiId { get; set; } = string.Empty;

    /// <summary>Prefix for invoice numbers, e.g. INV in INV-2026-0001.</summary>
    public string InvoicePrefix { get; set; } = "INV";

    /// <summary>Flat shipping charge; orders at or above <see cref="FreeShippingAbove"/> ship free.</summary>
    public decimal ShippingCharge { get; set; } = 500m;
    public decimal FreeShippingAbove { get; set; } = 20000m;
}
