using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using WoodOnlineService.Models;

namespace WoodOnlineService.Services;

public class SmtpSettings
{
    public bool Enabled { get; set; }
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "Wood Online Service";
    public string AdminEmail { get; set; } = string.Empty;

    public bool IsConfigured =>
        Enabled &&
        !string.IsNullOrWhiteSpace(Host) &&
        !string.IsNullOrWhiteSpace(UserName) &&
        !string.IsNullOrWhiteSpace(Password);
}

public interface INotificationService
{
    Task NotifyNewInquiryAsync(Inquiry inquiry);
    Task NotifyOrderPlacedAsync(Order order, string? customerEmail);
    Task NotifyPaymentSuccessAsync(Order order, PaymentTransaction transaction, string? customerEmail);
    Task NotifyPaymentFailedAsync(Order order, PaymentTransaction transaction, string? customerEmail);
    Task NotifyOrderStatusAsync(Order order, string? customerEmail);
    Task NotifyWelcomeAsync(string email, string fullName);
    Task NotifyNewReviewAsync(Review review, string productName);
    Task NotifyPasswordResetAsync(string email, string fullName, string resetLink);
}

/// <summary>
/// Sends transactional mail. When SMTP is not configured the message is logged instead,
/// so every flow still completes in development and before mail credentials exist.
/// A failed send never propagates — an order must not fail because a mail server was down.
/// </summary>
public class NotificationService : INotificationService
{
    private readonly SmtpSettings _smtp;
    private readonly SiteSettings _site;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IOptions<SmtpSettings> smtp,
        IOptions<SiteSettings> site,
        ILogger<NotificationService> logger)
    {
        _smtp = smtp.Value;
        _site = site.Value;
        _logger = logger;
    }

    private string SupportFooter =>
        $"""
        Need help? Call <a href="tel:{_site.Phone}" style="color:#6d4423;">{WebUtility.HtmlEncode(_site.Phone)}</a>
        or email <a href="mailto:{_site.Email}" style="color:#6d4423;">{WebUtility.HtmlEncode(_site.Email)}</a>.<br>
        {WebUtility.HtmlEncode(_site.WorkingHours)}
        """;

    public Task NotifyNewInquiryAsync(Inquiry inquiry)
    {
        var body = EmailTemplates.Shell(_site.ShopName, "New Inquiry",
            EmailTemplates.Heading("New customer inquiry") +
            EmailTemplates.InfoBox("From", inquiry.Name) +
            EmailTemplates.Paragraph($"Phone: {inquiry.Phone}") +
            EmailTemplates.Paragraph($"Email: {inquiry.Email ?? "Not provided"}") +
            EmailTemplates.Paragraph($"Product: {inquiry.Product?.Name ?? "General inquiry"}") +
            EmailTemplates.Paragraph($"Received: {inquiry.CreatedDate.ToLocalTime():dd MMM yyyy, hh:mm tt}") +
            EmailTemplates.Quote(inquiry.Message),
            "This is an automated notification from your website.");

        return SendAsync(_smtp.AdminEmail, $"New Inquiry from {inquiry.Name}", body);
    }

    public async Task NotifyOrderPlacedAsync(Order order, string? customerEmail)
    {
        var isCod = order.PaymentMethod == PaymentMethod.CashOnDelivery;
        var siteUrl = _site.SiteBaseUrl?.TrimEnd('/') ?? string.Empty;

        // Customer copy
        if (!string.IsNullOrWhiteSpace(customerEmail))
        {
            var customerBody = EmailTemplates.Shell(_site.ShopName, "Order Confirmation",
                EmailTemplates.Heading($"Thank you, {order.ShippingName}!") +
                EmailTemplates.Paragraph("We have received your order and will call you shortly to confirm it.") +
                EmailTemplates.InfoBox("Order Number", order.OrderNumber) +
                EmailTemplates.StatusTracker(order.OrderStatus) +
                EmailTemplates.OrderItemsTable(order) +
                EmailTemplates.AddressBlock(order) +
                EmailTemplates.Paragraph(isCod
                    ? $"Payment method: Cash on Delivery. Please keep Rs. {order.TotalAmount:N0} ready at the time of delivery."
                    : "Payment method: Online. Your payment has been received.") +
                (string.IsNullOrEmpty(siteUrl)
                    ? string.Empty
                    : EmailTemplates.Button("Track Your Order", $"{siteUrl}/Orders/Details/{order.OrderId}")),
                SupportFooter);

            await SendAsync(customerEmail, $"Order Confirmed - {order.OrderNumber}", customerBody);
        }

        // Admin copy
        var adminBody = EmailTemplates.Shell(_site.ShopName, "New Order",
            EmailTemplates.Heading("New order received") +
            EmailTemplates.InfoBox("Order Number", order.OrderNumber) +
            EmailTemplates.Paragraph($"Customer: {order.ShippingName} ({order.ShippingPhone})") +
            EmailTemplates.Paragraph($"Payment: {(isCod ? "Cash on Delivery" : "Online")}") +
            EmailTemplates.OrderItemsTable(order) +
            EmailTemplates.AddressBlock(order) +
            (string.IsNullOrWhiteSpace(order.Notes)
                ? string.Empty
                : EmailTemplates.Paragraph($"Customer note: {order.Notes}")),
            "This is an automated notification from your website.");

        await SendAsync(_smtp.AdminEmail, $"New Order {order.OrderNumber} - Rs. {order.TotalAmount:N0}", adminBody);
    }

    public async Task NotifyPaymentSuccessAsync(Order order, PaymentTransaction transaction, string? customerEmail)
    {
        var siteUrl = _site.SiteBaseUrl?.TrimEnd('/') ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(customerEmail))
        {
            var body = EmailTemplates.Shell(_site.ShopName, "Payment Received",
                EmailTemplates.Heading("Payment received") +
                EmailTemplates.Paragraph($"Thank you, {order.ShippingName}. We have received your payment.") +
                EmailTemplates.InfoBox("Amount Paid", $"Rs. {transaction.Amount:N0}") +
                EmailTemplates.Paragraph($"Order Number: {order.OrderNumber}") +
                EmailTemplates.Paragraph($"Payment Method: {transaction.PaymentMethod ?? "Online"}") +
                EmailTemplates.Paragraph($"Transaction ID: {transaction.PaymentId ?? "-"}") +
                EmailTemplates.OrderItemsTable(order) +
                (string.IsNullOrEmpty(siteUrl)
                    ? string.Empty
                    : EmailTemplates.Button("View Order", $"{siteUrl}/Orders/Details/{order.OrderId}")),
                SupportFooter);

            await SendAsync(customerEmail, $"Payment Received - {order.OrderNumber}", body);
        }

        var adminBody = EmailTemplates.Shell(_site.ShopName, "Payment Received",
            EmailTemplates.Heading("Payment received") +
            EmailTemplates.InfoBox("Amount", $"Rs. {transaction.Amount:N0}") +
            EmailTemplates.Paragraph($"Order: {order.OrderNumber}") +
            EmailTemplates.Paragraph($"Customer: {order.ShippingName} ({order.ShippingPhone})") +
            EmailTemplates.Paragraph($"Method: {transaction.PaymentMethod ?? "Online"}") +
            EmailTemplates.Paragraph($"Transaction ID: {transaction.PaymentId ?? "-"}"),
            "This is an automated notification from your website.");

        await SendAsync(_smtp.AdminEmail, $"Payment Received - {order.OrderNumber}", adminBody);
    }

    public Task NotifyPaymentFailedAsync(Order order, PaymentTransaction transaction, string? customerEmail)
    {
        if (string.IsNullOrWhiteSpace(customerEmail)) return Task.CompletedTask;

        var siteUrl = _site.SiteBaseUrl?.TrimEnd('/') ?? string.Empty;

        var body = EmailTemplates.Shell(_site.ShopName, "Payment Not Completed",
            EmailTemplates.Heading("Your payment could not be completed") +
            EmailTemplates.Paragraph($"Hello {order.ShippingName}, we could not confirm your payment for order {order.OrderNumber}.") +
            EmailTemplates.Paragraph("No amount has been charged. If money was deducted, it will be returned by your bank within 5 to 7 working days.") +
            (string.IsNullOrWhiteSpace(transaction.FailureReason)
                ? string.Empty
                : EmailTemplates.Paragraph($"Reason: {transaction.FailureReason}")) +
            EmailTemplates.Paragraph("You can retry the payment, or place the order with Cash on Delivery instead.") +
            (string.IsNullOrEmpty(siteUrl)
                ? string.Empty
                : EmailTemplates.Button("Retry Payment", $"{siteUrl}/Orders/Details/{order.OrderId}")),
            SupportFooter);

        return SendAsync(customerEmail, $"Payment Not Completed - {order.OrderNumber}", body);
    }

    public Task NotifyOrderStatusAsync(Order order, string? customerEmail)
    {
        if (string.IsNullOrWhiteSpace(customerEmail)) return Task.CompletedTask;

        var siteUrl = _site.SiteBaseUrl?.TrimEnd('/') ?? string.Empty;

        var (subject, message) = order.OrderStatus switch
        {
            OrderStatus.Confirmed => ("Order Confirmed",
                "Your order has been confirmed and we have started preparing it."),
            OrderStatus.Shipped => ("Order Shipped",
                string.IsNullOrWhiteSpace(order.TrackingNumber)
                    ? "Your order has been dispatched and is on its way."
                    : $"Your order has been dispatched. Tracking number: {order.TrackingNumber}"),
            OrderStatus.Delivered => ("Order Delivered",
                "Your order has been delivered. Thank you for shopping with us! We would love to hear your feedback."),
            OrderStatus.Cancelled => ("Order Cancelled",
                "Your order has been cancelled. If you have any questions, please contact us."),
            _ => ("Order Update", "There is an update on your order.")
        };

        var body = EmailTemplates.Shell(_site.ShopName, subject,
            EmailTemplates.Heading(subject) +
            EmailTemplates.Paragraph($"Hello {order.ShippingName},") +
            EmailTemplates.Paragraph(message) +
            EmailTemplates.InfoBox("Order Number", order.OrderNumber) +
            EmailTemplates.StatusTracker(order.OrderStatus) +
            EmailTemplates.OrderItemsTable(order) +
            (string.IsNullOrEmpty(siteUrl)
                ? string.Empty
                : EmailTemplates.Button("View Order", $"{siteUrl}/Orders/Details/{order.OrderId}")),
            SupportFooter);

        return SendAsync(customerEmail, $"{subject} - {order.OrderNumber}", body);
    }

    public Task NotifyWelcomeAsync(string email, string fullName)
    {
        var siteUrl = _site.SiteBaseUrl?.TrimEnd('/') ?? string.Empty;

        var body = EmailTemplates.Shell(_site.ShopName, "Welcome",
            EmailTemplates.Heading($"Welcome, {fullName}!") +
            EmailTemplates.Paragraph($"Thank you for creating an account with {_site.ShopName}.") +
            EmailTemplates.Paragraph("You can now place orders, track them, and leave reviews on the furniture you buy.") +
            EmailTemplates.Paragraph("Every piece we make is solid wood, seasoned and termite treated, and finished by hand.") +
            (string.IsNullOrEmpty(siteUrl)
                ? string.Empty
                : EmailTemplates.Button("Browse Products", $"{siteUrl}/Shop")),
            SupportFooter);

        return SendAsync(email, $"Welcome to {_site.ShopName}", body);
    }

    public Task NotifyNewReviewAsync(Review review, string productName)
    {
        var body = EmailTemplates.Shell(_site.ShopName, "New Review",
            EmailTemplates.Heading("A customer left a review") +
            EmailTemplates.InfoBox("Rating", $"{review.Rating} out of 5 stars") +
            EmailTemplates.Paragraph($"Product: {productName}") +
            EmailTemplates.Paragraph($"By: {review.AuthorName}") +
            (string.IsNullOrWhiteSpace(review.Title)
                ? string.Empty
                : EmailTemplates.Paragraph($"Title: {review.Title}")) +
            EmailTemplates.Quote(review.Comment) +
            EmailTemplates.Paragraph(review.Status == ReviewStatus.Pending
                ? "This review is awaiting your approval in the admin panel."
                : "This review is already live on the product page."),
            "This is an automated notification from your website.");

        return SendAsync(_smtp.AdminEmail, $"New {review.Rating}-star review on {productName}", body);
    }

    public Task NotifyPasswordResetAsync(string email, string fullName, string resetLink)
    {
        var body = EmailTemplates.Shell(_site.ShopName, "Reset Your Password",
            EmailTemplates.Heading("Reset your password") +
            EmailTemplates.Paragraph($"Hello {fullName},") +
            EmailTemplates.Paragraph(
                "We received a request to reset the password on your account. " +
                "Click the button below to choose a new one. This link is valid for a limited " +
                "time and can only be used once.") +
            EmailTemplates.Button("Reset Password", resetLink) +
            EmailTemplates.Paragraph(
                "If the button does not work, copy this address into your browser:") +
            EmailTemplates.Quote(resetLink) +
            EmailTemplates.Paragraph(
                "If you did not ask to reset your password, you can safely ignore this email - " +
                "your password will not change."),
            SupportFooter);

        return SendAsync(email, "Reset your password", body);
    }

    private async Task SendAsync(string? to, string subject, string htmlBody)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            _logger.LogInformation("Email skipped, no recipient configured: {Subject}", subject);
            return;
        }

        if (!_smtp.IsConfigured)
        {
            _logger.LogInformation("[EMAIL - SMTP disabled] To: {To} | Subject: {Subject}", to, subject);
            return;
        }

        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(
                    string.IsNullOrWhiteSpace(_smtp.FromEmail) ? _smtp.UserName : _smtp.FromEmail,
                    _smtp.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = System.Text.Encoding.UTF8,
                SubjectEncoding = System.Text.Encoding.UTF8
            };
            message.To.Add(to);

            using var client = new SmtpClient(_smtp.Host, _smtp.Port)
            {
                EnableSsl = _smtp.UseSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = new NetworkCredential(_smtp.UserName, _smtp.Password),
                Timeout = 20000
            };

            await client.SendMailAsync(message);
            _logger.LogInformation("Email sent to {To}: {Subject}", to, subject);
        }
        catch (Exception ex)
        {
            // Never let a mail failure break the customer's order, review or signup.
            _logger.LogError(ex, "Failed to send email to {To}: {Subject}", to, subject);
        }
    }
}
