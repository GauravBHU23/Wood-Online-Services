"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateCartQuantityAction, removeFromCartAction } from "@/lib/cart/actions";
import { useToast } from "@/components/ui/toast-provider";
import type { CartLine } from "@/lib/data/cart";

// Ported from Views/Cart/Index.cshtml's items table.
export function CartTable({ lines }: { lines: CartLine[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleQuantityChange(productId: number, quantity: number) {
    startTransition(async () => {
      await updateCartQuantityAction(productId, quantity);
      router.refresh();
    });
  }

  function handleRemove(productId: number) {
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
          {lines.map((line) => (
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
                <div className="d-flex justify-content-center">
                  <input
                    type="number"
                    defaultValue={line.quantity}
                    min={1}
                    max={line.product.stock_quantity}
                    className="form-control form-control-sm text-center"
                    style={{ width: 70 }}
                    disabled={pending}
                    onBlur={(e) => {
                      const q = Number(e.target.value);
                      if (Number.isFinite(q) && q !== line.quantity) handleQuantityChange(line.product.id, q);
                    }}
                  />
                </div>
              </td>
              <td className="text-end fw-bold">₹{Math.round(line.product.price * line.quantity).toLocaleString("en-IN")}</td>
              <td className="text-end">
                <button type="button" className="btn btn-sm btn-outline-danger" title="Remove" disabled={pending} onClick={() => handleRemove(line.product.id)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
