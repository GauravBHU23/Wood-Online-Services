/** Indian Rupee formatting used across the catalogue, cart, checkout and invoices. */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Every timestamp stored in the database is UTC (Postgres `timestamptz`), and the server this
// renders on is Vercel's, which runs in UTC regardless of where a visitor actually is — without
// an explicit timeZone, Intl.DateTimeFormat falls back to the RUNNING PROCESS's local zone, not
// the shop's. For a business that's entirely India-based (GST, Bihar address, Indian customers),
// every date/time shown anywhere in the app — order timestamps, admin dashboard, invoices, emails
// — should read as India Standard Time, so it's pinned explicitly here rather than left to
// whatever machine happens to be running the code.
const IST_TIME_ZONE = "Asia/Kolkata";

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IST_TIME_ZONE,
  }).format(date);
}

/** Discount % shown as a strike-through badge — mirrors Product.DiscountPercent in the C# model. */
export function discountPercent(price: number, oldPrice: number | null | undefined): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
