import "server-only";
import type { OrderWithItems } from "@/lib/data/orders";
import type { SiteSettingsFull } from "@/lib/data/site-settings";

// Ported from Services/InvoiceService.cs, including the Indian-numbering (lakh/crore)
// amount-in-words renderer — a bill is a legal document, so the words are the authority if the
// figures are disputed, and that logic is copied faithfully rather than approximated.

export interface InvoiceModel {
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  shippingCharge: number;
  grandTotal: number;
  roundOff: number;
  amountInWords: string;
  isInterState: boolean;
  hasGst: boolean;
  gstRate: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildInvoice(order: OrderWithItems, site: SiteSettingsFull): InvoiceModel {
  const hasGst = !!site.gst_number?.trim() && site.gst_rate > 0;
  const rate = hasGst ? site.gst_rate : 0;

  // A buyer outside the shop's own state pays IGST instead of CGST + SGST.
  const isInterState = hasGst && order.shipping_state?.trim().toLowerCase() !== site.state_name?.trim().toLowerCase();

  // Goods only. Delivery is billed separately below so the taxable value matches the items.
  const goodsTotal = order.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  let taxableValue: number;
  let totalTax: number;

  if (!hasGst) {
    taxableValue = goodsTotal;
    totalTax = 0;
  } else if (site.prices_include_gst) {
    // Listed prices already contain the tax, so extract it rather than adding it on.
    taxableValue = round2((goodsTotal * 100) / (100 + rate));
    totalTax = round2(goodsTotal - taxableValue);
  } else {
    taxableValue = goodsTotal;
    totalTax = round2((goodsTotal * rate) / 100);
  }

  const cgst = isInterState ? 0 : round2(totalTax / 2);
  const sgst = isInterState ? 0 : round2(totalTax - cgst); // absorbs the rounding remainder
  const igst = isInterState ? totalTax : 0;

  // The order total is what the customer actually agreed to pay; the invoice must match it.
  const payable = order.total_amount;
  const rounded = Math.round(payable);
  const roundOff = round2(rounded - payable);

  return {
    invoiceNumber: buildInvoiceNumber(order, site),
    invoiceDate: order.order_date,
    taxableValue,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    totalTax,
    shippingCharge: order.shipping_charge,
    grandTotal: rounded,
    roundOff,
    amountInWords: toIndianWords(rounded),
    isInterState,
    hasGst,
    gstRate: rate,
  };
}

/**
 * Derives the invoice number from the order number, so the same order always produces the same
 * invoice number no matter how many times the bill is reprinted.
 * WOS-20260908-0007 becomes INV-2026-0007.
 */
function buildInvoiceNumber(order: OrderWithItems, site: SiteSettingsFull): string {
  const prefix = site.invoice_prefix?.trim() || "INV";
  const parts = order.order_number.split("-");

  if (parts.length === 3 && parts[1].length >= 4) {
    return `${prefix}-${parts[1].slice(0, 4)}-${parts[2]}`;
  }

  const year = new Date(order.order_date).getFullYear();
  return `${prefix}-${year}-${String(order.id).padStart(4, "0")}`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** Renders an amount the way an Indian invoice does — lakh and crore, not million. */
export function toIndianWords(amount: number): string {
  if (amount <= 0) return "Zero Rupees Only";

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const words = rupees === 0 ? "Zero" : groupToWords(rupees);
  let text = `${words} Rupees`;

  if (paise > 0) text += ` and ${groupToWords(paise)} Paise`;

  return text + " Only";
}

function groupToWords(numberIn: number): string {
  let number = numberIn;
  if (number === 0) return "";

  const parts: string[] = [];

  const crore = Math.floor(number / 10_000_000);
  if (crore > 0) {
    parts.push(`${groupToWords(crore)} Crore`);
    number %= 10_000_000;
  }

  const lakh = Math.floor(number / 100_000);
  if (lakh > 0) {
    parts.push(`${upToNinetyNine(lakh)} Lakh`);
    number %= 100_000;
  }

  const thousand = Math.floor(number / 1_000);
  if (thousand > 0) {
    parts.push(`${upToNinetyNine(thousand)} Thousand`);
    number %= 1_000;
  }

  const hundred = Math.floor(number / 100);
  if (hundred > 0) {
    parts.push(`${ONES[hundred]} Hundred`);
    number %= 100;
  }

  if (number > 0) {
    if (parts.length > 0) parts.push("and");
    parts.push(upToNinetyNine(number));
  }

  return parts.join(" ");
}

function upToNinetyNine(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10;
  return ones === 0 ? tens : `${tens} ${ONES[ones]}`;
}
