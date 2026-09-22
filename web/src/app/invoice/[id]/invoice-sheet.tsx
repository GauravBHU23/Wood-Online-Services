import type { OrderWithItems } from "@/lib/data/orders";
import type { InvoiceModel } from "@/lib/data/invoice";
import type { SiteSettingsFull } from "@/lib/data/site-settings";
import { formatDate } from "@/lib/utils/format";

const inr2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Ported from Views/Shared/_Invoice.cshtml — same classes (.invoice-sheet, .inv-*) so the
// printed bill matches exactly, backed by src/styles/invoice.css.
export function InvoiceSheet({
  order,
  invoice,
  site,
  buyerEmail,
}: {
  order: OrderWithItems;
  invoice: InvoiceModel;
  site: SiteSettingsFull;
  buyerEmail: string | null;
}) {
  const isCod = order.payment_method === "cod";
  const isPaid = order.payment_status === "paid";

  // A bill for money already taken is a Tax Invoice; one that is still unpaid is a Proforma.
  const docTitle = invoice.hasGst ? (isPaid ? "TAX INVOICE" : "PROFORMA INVOICE") : isPaid ? "INVOICE" : "PROFORMA INVOICE";

  return (
    <div className="invoice-sheet">
      <div className="inv-head">
        <div className="inv-head__brand">
          <img src="/img/logo.svg" alt={site.shop_name} className="inv-logo" />
          <div className="inv-seller">
            <div className="inv-seller__name">{site.shop_name}</div>
            <div>{site.address_line1}</div>
            <div>{site.address_line2}</div>
            <div>Phone: {site.phone}</div>
            <div>Email: {site.email}</div>
            {site.gst_number && <div className="inv-seller__gst">GSTIN: {site.gst_number}</div>}
            {site.pan_number && <div>PAN: {site.pan_number}</div>}
          </div>
        </div>

        <div className="inv-head__meta">
          <div className="inv-doctype">{docTitle}</div>
          <table className="inv-meta-table">
            <tbody>
              <tr>
                <td>Invoice No.</td>
                <td>
                  <strong>{invoice.invoiceNumber}</strong>
                </td>
              </tr>
              <tr>
                <td>Invoice Date</td>
                <td>{formatDate(invoice.invoiceDate)}</td>
              </tr>
              <tr>
                <td>Order No.</td>
                <td>{order.order_number}</td>
              </tr>
              {site.state_name && (
                <tr>
                  <td>Place of Supply</td>
                  <td>{order.shipping_state}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className={`inv-status inv-status--${isPaid ? "paid" : "due"}`}>
            {isPaid ? "PAID" : isCod ? "PAYABLE ON DELIVERY" : "PAYMENT PENDING"}
          </div>
        </div>
      </div>

      <div className="inv-parties">
        <div className="inv-party">
          <div className="inv-party__label">Bill To</div>
          <div className="inv-party__name">{order.shipping_name}</div>
          <div>{order.shipping_address}</div>
          <div>
            {order.shipping_city}, {order.shipping_state} - {order.shipping_pin_code}
          </div>
          <div>Phone: {order.shipping_phone}</div>
          {buyerEmail && <div>Email: {buyerEmail}</div>}
        </div>

        <div className="inv-party">
          <div className="inv-party__label">Ship To</div>
          <div className="inv-party__name">{order.shipping_name}</div>
          <div>{order.shipping_address}</div>
          <div>
            {order.shipping_city}, {order.shipping_state} - {order.shipping_pin_code}
          </div>
          {order.tracking_number && (
            <div className="mt-1">
              Tracking: <strong>{order.tracking_number}</strong>
            </div>
          )}
        </div>
      </div>

      <table className="inv-items">
        <thead>
          <tr>
            <th style={{ width: 34 }}>#</th>
            <th>Description</th>
            <th style={{ width: 56 }} className="text-center">
              Qty
            </th>
            <th style={{ width: 96 }} className="text-end">
              Rate
            </th>
            <th style={{ width: 104 }} className="text-end">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={item.id}>
              <td>{i + 1}</td>
              <td>
                <div className="inv-item__name">{item.product_name}</div>
              </td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-end">{inr2(item.unit_price)}</td>
              <td className="text-end">{inr2(item.unit_price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-summary">
        <div className="inv-words">
          <div className="inv-words__label">Amount in words</div>
          <div className="inv-words__value">{invoice.amountInWords}</div>

          {invoice.hasGst && (
            <div className="inv-taxnote">
              {site.prices_include_gst
                ? `Listed prices are inclusive of GST at ${trimZero(invoice.gstRate)}%.`
                : `GST at ${trimZero(invoice.gstRate)}% has been added to the taxable value.`}
            </div>
          )}
        </div>

        <table className="inv-totals">
          <tbody>
            {invoice.hasGst ? (
              <>
                <tr>
                  <td>Taxable Value</td>
                  <td className="text-end">₹{inr2(invoice.taxableValue)}</td>
                </tr>
                {invoice.isInterState ? (
                  <tr>
                    <td>IGST {trimZero(invoice.gstRate)}%</td>
                    <td className="text-end">₹{inr2(invoice.igstAmount)}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td>CGST {trimZero(invoice.gstRate / 2)}%</td>
                      <td className="text-end">₹{inr2(invoice.cgstAmount)}</td>
                    </tr>
                    <tr>
                      <td>SGST {trimZero(invoice.gstRate / 2)}%</td>
                      <td className="text-end">₹{inr2(invoice.sgstAmount)}</td>
                    </tr>
                  </>
                )}
              </>
            ) : (
              <tr>
                <td>Subtotal</td>
                <td className="text-end">₹{inr2(order.sub_total)}</td>
              </tr>
            )}

            <tr>
              <td>Delivery</td>
              <td className="text-end">{invoice.shippingCharge <= 0 ? "Free" : `₹${inr2(invoice.shippingCharge)}`}</td>
            </tr>

            {invoice.roundOff !== 0 && (
              <tr>
                <td>Round Off</td>
                <td className="text-end">
                  {invoice.roundOff > 0 ? "+" : ""}₹{inr2(invoice.roundOff)}
                </td>
              </tr>
            )}

            <tr className="inv-totals__grand">
              <td>Grand Total</td>
              <td className="text-end">₹{inr2(invoice.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="inv-payment">
        <div className="inv-payment__col">
          <div className="inv-party__label">Payment Details</div>
          <div>
            Method: <strong>{isCod ? "Cash on Delivery" : "Online Payment"}</strong>
          </div>
          <div>
            Status: <strong>{order.payment_status}</strong>
          </div>
          {order.payment_reference && <div>Transaction Ref: {order.payment_reference}</div>}
          {isCod && !isPaid && <div className="inv-due">Amount due on delivery: ₹{inr2(invoice.grandTotal)}</div>}
        </div>

        {(site.bank_account_number || site.upi_id) && (
          <div className="inv-payment__col">
            <div className="inv-party__label">Bank Details</div>
            {site.bank_name && <div>Bank: {site.bank_name}</div>}
            {site.bank_account_number && <div>A/C: {site.bank_account_number}</div>}
            {site.bank_ifsc && <div>IFSC: {site.bank_ifsc}</div>}
            {site.upi_id && <div>UPI: {site.upi_id}</div>}
          </div>
        )}

        <div className="inv-payment__col inv-sign">
          <div className="inv-sign__for">For {site.shop_name}</div>
          <div className="inv-sign__space"></div>
          <div className="inv-sign__label">Authorised Signatory</div>
        </div>
      </div>

      {order.notes && (
        <div className="inv-notes">
          <span className="inv-party__label">Customer Note</span>
          <div>{order.notes}</div>
        </div>
      )}

      <div className="inv-terms">
        <div className="inv-party__label">Terms &amp; Conditions</div>
        <ol>
          <li>Goods once sold are taken back only if they are defective or damaged in transit.</li>
          <li>Please report transit damage within 48 hours of delivery, with photographs.</li>
          <li>Our joinery and workmanship are warranted for 12 months from the date of delivery.</li>
          <li>Solid wood shows natural variation in grain and colour; this is not a defect.</li>
          <li>Made-to-order items cannot be cancelled once work has begun.</li>
        </ol>
      </div>

      <div className="inv-footer">
        <div>This is a computer-generated invoice and is valid without a physical signature.</div>
        <div>
          {site.shop_name} &middot; {site.phone} &middot; {site.email}
        </div>
      </div>
    </div>
  );
}

function trimZero(n: number): string {
  return Number(n.toFixed(2)).toString();
}
