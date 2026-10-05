"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCartQuantityAction, removeFromCartAction } from "@/lib/cart/actions";
import { useToast } from "@/components/ui/toast-provider";
import type { CartLine } from "@/lib/data/cart";

// Ported from Views/Cart/Index.cshtml's items table.
export function CartTable({ lines }: { lines: CartLine[] }) {
  const [pending, startTransition] = useTransition();
  // Which product's row is mid-update, so editing one line's quantity doesn't visually disable
  // every other row's remove button too — pending alone (a single shared boolean) can't tell rows
  // apart since router.refresh() re-renders the whole table for any of them.
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const router = useRouter();
  const toast = useToast();

  function handleQuantityChange(productId: number, quantity: number) {
    setActiveProductId(productId);
    startTransition(async () => {
      await updateCartQuantityAction(productId, quantity);
      router.refresh();
    });
  }

  function handleRemove(productId: number) {
    setActiveProductId(productId);
    startTransition(async () => {
      await removeFromCartAction(productId);
      toast.success("Item removed from your cart.");
      router.refresh();
    });
  }

  return (
    <div className="table-wrap">
      <table className="table table-wood mb-0 align-middle">
        <thead>
          <tr>
            <th colSpan={2}>Product</th>
            <th className="text-end">Price</th>
            <th className="text-center" style={{ width: 150 }}>
              Quantity
            </th>
            <th className="text-end">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const rowBusy = pending && activeProductId === line.product.id;
            return (
            <tr key={line.id}>
              <td style={{ width: 90 }}>
                <Link href={`/shop/${line.product.id}`}>
                  <img
                    src={line.product.image_url || "/img/cat-custom.svg"}
                    alt={line.product.name}
                    style={{ width: 76, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
                  />
                </Link>
              </td>
              <td>
                <Link href={`/shop/${line.product.id}`} className="fw-bold" style={{ color: "var(--wood-900)" }}>
                  {line.product.name}
                </Link>
                {line.product.wood_type && <div className="small text-muted-wood">{line.product.wood_type}</div>}
                {line.quantity >= line.product.stock_quantity && (
                  <div className="small text-danger">Only {line.product.stock_quantity} available</div>
                )}
              </td>
              <td className="text-end">₹{Math.round(line.product.price).toLocaleString("en-IN")}</td>
              <td>
                <div className="d-flex justify-content-center align-items-center gap-2">
                  <div className="input-group input-group-sm" style={{ width: 120 }}>
                    <button
                      className="btn btn-outline-wood"
                      type="button"
                      disabled={rowBusy || line.quantity <= 1}
                      aria-label={`Decrease quantity of ${line.product.name}`}
                      onClick={() => handleQuantityChange(line.product.id, line.quantity - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={line.quantity}
                      min={1}
                      max={line.product.stock_quantity}
                      className="form-control text-center"
                      aria-label={`Quantity of ${line.product.name}`}
                      disabled={rowBusy}
                      readOnly
                    />
                    <button
                      className="btn btn-outline-wood"
                      type="button"
                      disabled={rowBusy || line.quantity >= line.product.stock_quantity}
                      aria-label={`Increase quantity of ${line.product.name}`}
                      onClick={() => handleQuantityChange(line.product.id, line.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  {rowBusy && <span className="wos-btn-spinner" aria-hidden="true" />}
                </div>
              </td>
              <td className="text-end fw-bold">₹{Math.round(line.product.price * line.quantity).toLocaleString("en-IN")}</td>
              <td className="text-end">
                <button
                  type="button"
                  className={`btn btn-icon-sm btn-outline-danger${rowBusy ? " is-busy" : ""}`}
                  title="Remove"
                  aria-label={`Remove ${line.product.name} from cart`}
                  disabled={rowBusy}
                  onClick={() => handleRemove(line.product.id)}
                >
                  {rowBusy ? <span className="wos-btn-spinner" aria-hidden="true" /> : "✕"}
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
