using System.Net;
using System.Text;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

/// <summary>Responsive HTML email bodies. Table-based layout so Outlook and Gmail both render them.</summary>
public static class EmailTemplates
{
    private const string Brand = "#6d4423";
    private const string BrandDark = "#3f2817";
    private const string Cream = "#faf5ec";
    private const string Line = "#e3d7c4";

    public static string Shell(string shopName, string title, string bodyHtml, string footerNote)
    {
        return $"""
        <!DOCTYPE html>
        <html><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>{E(title)}</title></head>
        <body style="margin:0;padding:0;background:{Cream};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{Cream};padding:24px 12px;">
            <tr><td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="max-width:600px;background:#ffffff;border:1px solid {Line};border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="background:{BrandDark};padding:22px 28px;">
                    <div style="color:#ffffff;font-size:20px;font-weight:700;font-family:Georgia,serif;">{E(shopName)}</div>
                    <div style="color:#d0a468;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">
                      Handcrafted Wooden Furniture
                    </div>
                  </td>
                </tr>
                <tr><td style="padding:28px;">{bodyHtml}</td></tr>
                <tr>
                  <td style="background:{Cream};padding:18px 28px;border-top:1px solid {Line};">
                    <div style="color:#6b5b4c;font-size:12px;line-height:1.6;">{footerNote}</div>
                  </td>
                </tr>
              </table>
              <div style="font-size:11px;margin-top:14px;color:#8a7867;">
                Designed &amp; Developed by Er Gaurav Kumar
              </div>
            </td></tr>
          </table>
        </body></html>
        """;
    }

    public static string Heading(string text) =>
        $"""<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:{BrandDark};">{E(text)}</h1>""";

    public static string Paragraph(string text) =>
        $"""<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2c2119;">{E(text)}</p>""";

    public static string Button(string label, string url) =>
        $"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
          <tr><td style="background:{Brand};border-radius:8px;">
            <a href="{E(url)}" style="display:inline-block;padding:12px 26px;color:#ffffff;
               font-size:15px;font-weight:600;text-decoration:none;">{E(label)}</a>
          </td></tr>
        </table>
        """;

    /// <summary>Indented block for customer-written text such as an inquiry or a review.</summary>
    public static string Quote(string text)
    {
        var encoded = E(text);
        return "<div style=\"background:" + Cream + ";border-left:3px solid " + Brand +
               ";padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.7;" +
               "color:#2c2119;white-space:pre-line;\">" + encoded + "</div>";
    }

    public static string InfoBox(string label, string value) =>
        $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:{Cream};border:1px solid {Line};border-radius:8px;margin:0 0 18px;">
          <tr><td style="padding:14px 18px;">
            <div style="font-size:12px;color:#6b5b4c;text-transform:uppercase;letter-spacing:.5px;">{E(label)}</div>
            <div style="font-size:19px;font-weight:700;color:{BrandDark};margin-top:3px;">{E(value)}</div>
          </td></tr>
        </table>
        """;

    /// <summary>A large, letter-spaced code block for OTPs — easier to read and copy than InfoBox's smaller text.</summary>
    public static string CodeBox(string code) =>
        $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:{Cream};border:1px solid {Line};border-radius:8px;margin:0 0 18px;">
          <tr><td style="padding:20px;text-align:center;">
            <div style="font-size:34px;font-weight:700;color:{BrandDark};letter-spacing:10px;font-family:'Courier New',monospace;">
              {E(code)}
            </div>
          </td></tr>
        </table>
        """;

    public static string OrderItemsTable(Order order)
    {
        var rows = new StringBuilder();

        foreach (var item in order.Items)
        {
            rows.Append($"""
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid {Line};font-size:14px;color:#2c2119;">
                    {E(item.ProductName)}<br>
                    <span style="color:#6b5b4c;font-size:12px;">Rs. {item.UnitPrice:N0} &times; {item.Quantity}</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid {Line};font-size:14px;font-weight:600;
                             color:#2c2119;text-align:right;white-space:nowrap;">Rs. {item.LineTotal:N0}</td>
                </tr>
                """);
        }

        var shipping = order.ShippingCharge <= 0 ? "Free" : $"Rs. {order.ShippingCharge:N0}";

        return $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
          <tr>
            <th align="left" style="padding:0 0 8px;border-bottom:2px solid {Line};font-size:12px;
                                    text-transform:uppercase;color:#6b5b4c;letter-spacing:.5px;">Item</th>
            <th align="right" style="padding:0 0 8px;border-bottom:2px solid {Line};font-size:12px;
                                     text-transform:uppercase;color:#6b5b4c;letter-spacing:.5px;">Amount</th>
          </tr>
          {rows}
          <tr>
            <td style="padding:10px 0 2px;font-size:14px;color:#6b5b4c;">Subtotal</td>
            <td style="padding:10px 0 2px;font-size:14px;text-align:right;color:#2c2119;">Rs. {order.SubTotal:N0}</td>
          </tr>
          <tr>
            <td style="padding:2px 0;font-size:14px;color:#6b5b4c;">Delivery</td>
            <td style="padding:2px 0;font-size:14px;text-align:right;color:#2c2119;">{shipping}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;border-top:2px solid {Line};font-size:16px;font-weight:700;color:{BrandDark};">Total</td>
            <td style="padding:12px 0 0;border-top:2px solid {Line};font-size:18px;font-weight:700;
                       text-align:right;color:{BrandDark};">Rs. {order.TotalAmount:N0}</td>
          </tr>
        </table>
        """;
    }

    public static string AddressBlock(Order order) =>
        $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:{Cream};border:1px solid {Line};border-radius:8px;margin:0 0 18px;">
          <tr><td style="padding:14px 18px;font-size:13px;line-height:1.7;color:#2c2119;">
            <div style="font-size:12px;color:#6b5b4c;text-transform:uppercase;letter-spacing:.5px;
                        margin-bottom:6px;">Delivery Address</div>
            <strong>{E(order.ShippingName)}</strong><br>
            {E(order.ShippingAddress)}<br>
            {E(order.ShippingCity)}, {E(order.ShippingState)} - {E(order.ShippingPinCode)}<br>
            Phone: {E(order.ShippingPhone)}
          </td></tr>
        </table>
        """;

    public static string StatusTracker(OrderStatus status)
    {
        if (status == OrderStatus.Cancelled)
        {
            return $"""
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fdecea;border:1px solid #f5c2bd;border-radius:8px;margin:0 0 18px;">
              <tr><td style="padding:14px 18px;font-size:14px;color:#b3261e;text-align:center;">
                This order has been cancelled.
              </td></tr>
            </table>
            """;
        }

        var stage = status switch
        {
            OrderStatus.Pending => 0,
            OrderStatus.Confirmed => 1,
            OrderStatus.Shipped => 2,
            OrderStatus.Delivered => 3,
            _ => 0
        };

        var labels = new[] { "Received", "Confirmed", "Shipped", "Delivered" };
        var cells = new StringBuilder();

        for (var i = 0; i < labels.Length; i++)
        {
            var done = i <= stage;
            var bg = done ? "#2f7d4f" : "#ffffff";
            var border = done ? "#2f7d4f" : Line;
            var fg = done ? "#ffffff" : "#6b5b4c";
            var labelColor = done ? BrandDark : "#6b5b4c";

            cells.Append($"""
                <td align="center" style="width:25%;padding:0 2px;">
                  <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:{bg};
                              border:2px solid {border};color:{fg};font-size:13px;font-weight:700;
                              margin:0 auto 6px;">{(done ? "&#10003;" : (i + 1).ToString())}</div>
                  <div style="font-size:11px;font-weight:600;color:{labelColor};">{labels[i]}</div>
                </td>
                """);
        }

        return $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
          <tr>{cells}</tr>
        </table>
        """;
    }

    /// <summary>HTML-encode so a customer-supplied name or note can never inject markup into the email.</summary>
    private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
}
