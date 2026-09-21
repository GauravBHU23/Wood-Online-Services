// Responsive HTML email bodies, ported from Services/EmailTemplates.cs. Table-based layout so
// Outlook and Gmail both render them. Every value goes through escapeHtml() before it reaches
// markup, so a customer-supplied name or note can never inject markup into the email.

const BRAND = "#6d4423";
const BRAND_DARK = "#3f2817";
const CREAM = "#faf5ec";
const LINE = "#e3d7c4";

export function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function shell(shopName: string, title: string, bodyHtml: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:${BRAND_DARK};padding:22px 28px;">
            <div style="color:#ffffff;font-size:20px;font-weight:700;font-family:Georgia,serif;">${escapeHtml(shopName)}</div>
            <div style="color:#d0a468;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">
              Handcrafted Wooden Furniture
            </div>
          </td>
        </tr>
        <tr><td style="padding:28px;">${bodyHtml}</td></tr>
        <tr>
          <td style="background:${CREAM};padding:18px 28px;border-top:1px solid ${LINE};">
            <div style="color:#6b5b4c;font-size:12px;line-height:1.6;">${footerNote}</div>
          </td>
        </tr>
      </table>
      <div style="font-size:11px;margin-top:14px;color:#8a7867;">
        Designed &amp; Developed by Er Gaurav Kumar
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export const heading = (text: string) =>
  `<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:${BRAND_DARK};">${escapeHtml(text)}</h1>`;

export const paragraph = (text: string) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2c2119;">${escapeHtml(text)}</p>`;

export const button = (label: string, url: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
  <tr><td style="background:${BRAND};border-radius:8px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 26px;color:#ffffff;
       font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;

/** Indented block for customer-written text such as an inquiry or a review. */
export const quote = (text: string) =>
  `<div style="background:${CREAM};border-left:3px solid ${BRAND};padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.7;color:#2c2119;white-space:pre-line;">${escapeHtml(text)}</div>`;

export const infoBox = (label: string, value: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:${CREAM};border:1px solid ${LINE};border-radius:8px;margin:0 0 18px;">
  <tr><td style="padding:14px 18px;">
    <div style="font-size:12px;color:#6b5b4c;text-transform:uppercase;letter-spacing:.5px;">${escapeHtml(label)}</div>
    <div style="font-size:19px;font-weight:700;color:${BRAND_DARK};margin-top:3px;">${escapeHtml(value)}</div>
  </td></tr>
</table>`;

/** A large, letter-spaced code block for OTPs. */
export const codeBox = (code: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:${CREAM};border:1px solid ${LINE};border-radius:8px;margin:0 0 18px;">
  <tr><td style="padding:20px;text-align:center;">
    <div style="font-size:34px;font-weight:700;color:${BRAND_DARK};letter-spacing:10px;font-family:'Courier New',monospace;">
      ${escapeHtml(code)}
    </div>
  </td></tr>
</table>`;

export interface OrderEmailItem {
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface OrderEmailData {
  sub_total: number;
  shipping_charge: number;
  total_amount: number;
  items: OrderEmailItem[];
}

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");

export function orderItemsTable(order: OrderEmailData): string {
  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:#2c2119;">
            ${escapeHtml(item.product_name)}<br>
            <span style="color:#6b5b4c;font-size:12px;">Rs. ${inr(item.unit_price)} &times; ${item.quantity}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:600;
                     color:#2c2119;text-align:right;white-space:nowrap;">Rs. ${inr(item.unit_price * item.quantity)}</td>
        </tr>`
    )
    .join("");

  const shipping = order.shipping_charge <= 0 ? "Free" : `Rs. ${inr(order.shipping_charge)}`;

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
  <tr>
    <th align="left" style="padding:0 0 8px;border-bottom:2px solid ${LINE};font-size:12px;
                            text-transform:uppercase;color:#6b5b4c;letter-spacing:.5px;">Item</th>
    <th align="right" style="padding:0 0 8px;border-bottom:2px solid ${LINE};font-size:12px;
                             text-transform:uppercase;color:#6b5b4c;letter-spacing:.5px;">Amount</th>
  </tr>
  ${rows}
  <tr>
    <td style="padding:10px 0 2px;font-size:14px;color:#6b5b4c;">Subtotal</td>
    <td style="padding:10px 0 2px;font-size:14px;text-align:right;color:#2c2119;">Rs. ${inr(order.sub_total)}</td>
  </tr>
  <tr>
    <td style="padding:2px 0;font-size:14px;color:#6b5b4c;">Delivery</td>
    <td style="padding:2px 0;font-size:14px;text-align:right;color:#2c2119;">${shipping}</td>
  </tr>
  <tr>
    <td style="padding:12px 0 0;border-top:2px solid ${LINE};font-size:16px;font-weight:700;color:${BRAND_DARK};">Total</td>
    <td style="padding:12px 0 0;border-top:2px solid ${LINE};font-size:18px;font-weight:700;
               text-align:right;color:${BRAND_DARK};">Rs. ${inr(order.total_amount)}</td>
  </tr>
</table>`;
}

export interface OrderAddressData {
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pin_code: string;
  shipping_phone: string;
}

export const addressBlock = (order: OrderAddressData) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:${CREAM};border:1px solid ${LINE};border-radius:8px;margin:0 0 18px;">
  <tr><td style="padding:14px 18px;font-size:13px;line-height:1.7;color:#2c2119;">
    <div style="font-size:12px;color:#6b5b4c;text-transform:uppercase;letter-spacing:.5px;
                margin-bottom:6px;">Delivery Address</div>
    <strong>${escapeHtml(order.shipping_name)}</strong><br>
    ${escapeHtml(order.shipping_address)}<br>
    ${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_state)} - ${escapeHtml(order.shipping_pin_code)}<br>
    Phone: ${escapeHtml(order.shipping_phone)}
  </td></tr>
</table>`;

export type OrderStatusForEmail = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export function statusTracker(status: OrderStatusForEmail): string {
  if (status === "cancelled") {
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#fdecea;border:1px solid #f5c2bd;border-radius:8px;margin:0 0 18px;">
  <tr><td style="padding:14px 18px;font-size:14px;color:#b3261e;text-align:center;">
    This order has been cancelled.
  </td></tr>
</table>`;
  }

  const stageByStatus: Record<OrderStatusForEmail, number> = {
    pending: 0,
    confirmed: 1,
    shipped: 2,
    delivered: 3,
    cancelled: 0,
  };
  const stage = stageByStatus[status];
  const labels = ["Received", "Confirmed", "Shipped", "Delivered"];

  const cells = labels
    .map((label, i) => {
      const done = i <= stage;
      const bg = done ? "#2f7d4f" : "#ffffff";
      const border = done ? "#2f7d4f" : LINE;
      const fg = done ? "#ffffff" : "#6b5b4c";
      const labelColor = done ? BRAND_DARK : "#6b5b4c";
      return `
        <td align="center" style="width:25%;padding:0 2px;">
          <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${bg};
                      border:2px solid ${border};color:${fg};font-size:13px;font-weight:700;
                      margin:0 auto 6px;">${done ? "&#10003;" : i + 1}</div>
          <div style="font-size:11px;font-weight:600;color:${labelColor};">${label}</div>
        </td>`;
    })
    .join("");

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
  <tr>${cells}</tr>
</table>`;
}
