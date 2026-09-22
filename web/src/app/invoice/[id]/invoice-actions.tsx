"use client";

import Link from "next/link";

// Ported from Views/Orders/Invoice.cshtml's print/back buttons.
export function InvoiceActions({ orderId }: { orderId: number }) {
  return (
    <div className="no-print" style={{ maxWidth: 820, margin: "0 auto 14px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
      <button onClick={() => window.print()} className="btn btn-wood">
        Print / Save as PDF
      </button>
      <Link href={`/orders/${orderId}`} className="btn btn-outline-wood">
        Back to Order
      </Link>
    </div>
  );
}
