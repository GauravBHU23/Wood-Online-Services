import "server-only";
import nodemailer from "nodemailer";
import {
  shell,
  heading,
  paragraph,
  button,
  quote,
  infoBox,
  codeBox,
  orderItemsTable,
  addressBlock,
  statusTracker,
  type OrderEmailData,
  type OrderAddressData,
  type OrderStatusForEmail,
} from "@/lib/email/templates";

// Ported from Services/NotificationService.cs. When SMTP is not configured the message is
// logged instead, so every flow still completes in development and before mail credentials
// exist. A failed send never throws — an order must not fail because a mail server was down.

const SMTP_ENABLED = process.env.SMTP_ENABLED === "true";
const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? "";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_ADMIN_EMAIL = process.env.SMTP_ADMIN_EMAIL ?? "";
const FROM_NAME = "Wood Online Service";

const isSmtpConfigured = () =>
  SMTP_ENABLED && !!SMTP_HOST && !!SMTP_USER && !!SMTP_PASSWORD;

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }
  return transporter;
}

async function send(to: string | null | undefined, subject: string, html: string): Promise<void> {
  if (!to) {
    console.log(`[EMAIL] Skipped, no recipient configured: ${subject}`);
    return;
  }

  if (!isSmtpConfigured()) {
    console.log(`[EMAIL - SMTP disabled] To: ${to} | Subject: ${subject}`);
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
  } catch (err) {
    // Never let a mail failure break the customer's order, review or signup.
    console.error(`[EMAIL] Failed to send to ${to}: ${subject}`, err);
  }
}

export interface SiteEmailConfig {
  shopName: string;
  phone: string;
  email: string;
  workingHours: string;
  siteBaseUrl: string;
}

function supportFooter(site: SiteEmailConfig): string {
  return `Need help? Call <a href="tel:${site.phone}" style="color:#6d4423;">${site.phone}</a>
or email <a href="mailto:${site.email}" style="color:#6d4423;">${site.email}</a>.<br>
${site.workingHours}`;
}

export interface InquiryEmailData {
  name: string;
  phone: string;
  email: string | null;
  productName: string | null;
  message: string;
  createdAt: string;
}

export async function notifyNewInquiry(site: SiteEmailConfig, inquiry: InquiryEmailData) {
  const body = shell(
    site.shopName,
    "New Inquiry",
    heading("New customer inquiry") +
      infoBox("From", inquiry.name) +
      paragraph(`Phone: ${inquiry.phone}`) +
      paragraph(`Email: ${inquiry.email ?? "Not provided"}`) +
      paragraph(`Product: ${inquiry.productName ?? "General inquiry"}`) +
      paragraph(`Received: ${new Date(inquiry.createdAt).toLocaleString("en-IN")}`) +
      quote(inquiry.message),
    "This is an automated notification from your website."
  );

  await send(SMTP_ADMIN_EMAIL, `New Inquiry from ${inquiry.name}`, body);
}

export interface OrderEmailOrder extends OrderEmailData, OrderAddressData {
  id: number;
  order_number: string;
  payment_method: "cod" | "online";
  notes: string | null;
}

export async function notifyOrderPlaced(
  site: SiteEmailConfig,
  order: OrderEmailOrder,
  customerEmail: string | null
) {
  const isCod = order.payment_method === "cod";
  const siteUrl = site.siteBaseUrl.replace(/\/$/, "");

  if (customerEmail) {
    const customerBody = shell(
      site.shopName,
      "Order Confirmation",
      heading(`Thank you, ${order.shipping_name}!`) +
        paragraph("We have received your order and will call you shortly to confirm it.") +
        infoBox("Order Number", order.order_number) +
        statusTracker("pending") +
        orderItemsTable(order) +
        addressBlock(order) +
        paragraph(
          isCod
            ? `Payment method: Cash on Delivery. Please keep Rs. ${Math.round(order.total_amount).toLocaleString("en-IN")} ready at the time of delivery.`
            : "Payment method: Online. Your payment has been received."
        ) +
        (siteUrl ? button("Track Your Order", `${siteUrl}/orders/${order.id}`) : ""),
      supportFooter(site)
    );
    await send(customerEmail, `Order Confirmed - ${order.order_number}`, customerBody);
  }

  const adminBody = shell(
    site.shopName,
    "New Order",
    heading("New order received") +
      infoBox("Order Number", order.order_number) +
      paragraph(`Customer: ${order.shipping_name} (${order.shipping_phone})`) +
      paragraph(`Payment: ${isCod ? "Cash on Delivery" : "Online"}`) +
      orderItemsTable(order) +
      addressBlock(order) +
      (order.notes ? paragraph(`Customer note: ${order.notes}`) : ""),
    "This is an automated notification from your website."
  );
  await send(
    SMTP_ADMIN_EMAIL,
    `New Order ${order.order_number} - Rs. ${Math.round(order.total_amount).toLocaleString("en-IN")}`,
    adminBody
  );
}

export interface PaymentTransactionEmailData {
  amount: number;
  payment_method: string | null;
  payment_id: string | null;
  failure_reason: string | null;
}

export async function notifyPaymentSuccess(
  site: SiteEmailConfig,
  order: OrderEmailOrder,
  transaction: PaymentTransactionEmailData,
  customerEmail: string | null
) {
  const siteUrl = site.siteBaseUrl.replace(/\/$/, "");

  if (customerEmail) {
    const body = shell(
      site.shopName,
      "Payment Received",
      heading("Payment received") +
        paragraph(`Thank you, ${order.shipping_name}. We have received your payment.`) +
        infoBox("Amount Paid", `Rs. ${Math.round(transaction.amount).toLocaleString("en-IN")}`) +
        paragraph(`Order Number: ${order.order_number}`) +
        paragraph(`Payment Method: ${transaction.payment_method ?? "Online"}`) +
        paragraph(`Transaction ID: ${transaction.payment_id ?? "-"}`) +
        orderItemsTable(order) +
        (siteUrl ? button("View Order", `${siteUrl}/orders/${order.id}`) : ""),
      supportFooter(site)
    );
    await send(customerEmail, `Payment Received - ${order.order_number}`, body);
  }

  const adminBody = shell(
    site.shopName,
    "Payment Received",
    heading("Payment received") +
      infoBox("Amount", `Rs. ${Math.round(transaction.amount).toLocaleString("en-IN")}`) +
      paragraph(`Order: ${order.order_number}`) +
      paragraph(`Customer: ${order.shipping_name} (${order.shipping_phone})`) +
      paragraph(`Method: ${transaction.payment_method ?? "Online"}`) +
      paragraph(`Transaction ID: ${transaction.payment_id ?? "-"}`),
    "This is an automated notification from your website."
  );
  await send(SMTP_ADMIN_EMAIL, `Payment Received - ${order.order_number}`, adminBody);
}

export async function notifyPaymentFailed(
  site: SiteEmailConfig,
  order: OrderEmailOrder,
  transaction: PaymentTransactionEmailData,
  customerEmail: string | null
) {
  if (!customerEmail) return;
  const siteUrl = site.siteBaseUrl.replace(/\/$/, "");

  const body = shell(
    site.shopName,
    "Payment Not Completed",
    heading("Your payment could not be completed") +
      paragraph(`Hello ${order.shipping_name}, we could not confirm your payment for order ${order.order_number}.`) +
      paragraph(
        "No amount has been charged. If money was deducted, it will be returned by your bank within 5 to 7 working days."
      ) +
      (transaction.failure_reason ? paragraph(`Reason: ${transaction.failure_reason}`) : "") +
      paragraph("You can retry the payment, or place the order with Cash on Delivery instead.") +
      (siteUrl ? button("Retry Payment", `${siteUrl}/orders/${order.id}`) : ""),
    supportFooter(site)
  );
  await send(customerEmail, `Payment Not Completed - ${order.order_number}`, body);
}

export async function notifyOrderStatus(
  site: SiteEmailConfig,
  order: OrderEmailOrder,
  status: OrderStatusForEmail,
  trackingNumber: string | null,
  customerEmail: string | null
) {
  if (!customerEmail) return;
  const siteUrl = site.siteBaseUrl.replace(/\/$/, "");

  const messages: Record<OrderStatusForEmail, [string, string]> = {
    pending: ["Order Update", "There is an update on your order."],
    confirmed: ["Order Confirmed", "Your order has been confirmed and we have started preparing it."],
    shipped: [
      "Order Shipped",
      trackingNumber
        ? `Your order has been dispatched. Tracking number: ${trackingNumber}`
        : "Your order has been dispatched and is on its way.",
    ],
    delivered: [
      "Order Delivered",
      "Your order has been delivered. Thank you for shopping with us! We would love to hear your feedback.",
    ],
    cancelled: ["Order Cancelled", "Your order has been cancelled. If you have any questions, please contact us."],
  };
  const [subject, message] = messages[status];

  const body = shell(
    site.shopName,
    subject,
    heading(subject) +
      paragraph(`Hello ${order.shipping_name},`) +
      paragraph(message) +
      infoBox("Order Number", order.order_number) +
      statusTracker(status) +
      orderItemsTable(order) +
      (siteUrl ? button("View Order", `${siteUrl}/orders/${order.id}`) : ""),
    supportFooter(site)
  );
  await send(customerEmail, `${subject} - ${order.order_number}`, body);
}

export async function notifyWelcome(site: SiteEmailConfig, email: string, fullName: string) {
  const siteUrl = site.siteBaseUrl.replace(/\/$/, "");

  const body = shell(
    site.shopName,
    "Welcome",
    heading(`Welcome, ${fullName}!`) +
      paragraph(`Thank you for creating an account with ${site.shopName}.`) +
      paragraph("You can now place orders, track them, and leave reviews on the furniture you buy.") +
      paragraph("Every piece we make is solid wood, seasoned and termite treated, and finished by hand.") +
      (siteUrl ? button("Browse Products", `${siteUrl}/shop`) : ""),
    supportFooter(site)
  );
  await send(email, `Welcome to ${site.shopName}`, body);
}

export interface ReviewEmailData {
  rating: number;
  authorName: string;
  title: string | null;
  comment: string;
  status: "pending" | "approved" | "rejected";
}

export async function notifyNewReview(site: SiteEmailConfig, review: ReviewEmailData, productName: string) {
  const body = shell(
    site.shopName,
    "New Review",
    heading("A customer left a review") +
      infoBox("Rating", `${review.rating} out of 5 stars`) +
      paragraph(`Product: ${productName}`) +
      paragraph(`By: ${review.authorName}`) +
      (review.title ? paragraph(`Title: ${review.title}`) : "") +
      quote(review.comment) +
      paragraph(
        review.status === "pending"
          ? "This review is awaiting your approval in the admin panel."
          : "This review is already live on the product page."
      ),
    "This is an automated notification from your website."
  );
  await send(SMTP_ADMIN_EMAIL, `New ${review.rating}-star review on ${productName}`, body);
}

export async function notifyPasswordReset(
  site: SiteEmailConfig,
  email: string,
  fullName: string,
  resetLink: string
) {
  const body = shell(
    site.shopName,
    "Reset Your Password",
    heading("Reset your password") +
      paragraph(`Hello ${fullName},`) +
      paragraph(
        "We received a request to reset the password on your account. Click the button below to choose a new one. This link is valid for a limited time and can only be used once."
      ) +
      button("Reset Password", resetLink) +
      paragraph("If the button does not work, copy this address into your browser:") +
      quote(resetLink) +
      paragraph(
        "If you did not ask to reset your password, you can safely ignore this email - your password will not change."
      ),
    supportFooter(site)
  );
  await send(email, "Reset your password", body);
}

export async function notifyAdminOtp(
  site: SiteEmailConfig,
  email: string,
  fullName: string,
  code: string,
  validForMinutes: number
) {
  const body = shell(
    site.shopName,
    "Admin Sign-In Code",
    heading("Your sign-in code") +
      paragraph(`Hello ${fullName},`) +
      paragraph(
        `Enter this code to finish signing in to the admin panel. It expires in ${validForMinutes} minutes and can be used once.`
      ) +
      codeBox(code) +
      paragraph(
        "If you did not just try to sign in, someone else may have your password - change it as soon as possible and do not share this code with anyone."
      ),
    supportFooter(site)
  );
  await send(email, `${code} is your admin sign-in code`, body);
}
