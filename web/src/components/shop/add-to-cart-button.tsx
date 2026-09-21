"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

// Ported from wwwroot/js/site.js#initAddToCart (form.js-add-to-cart) — adds without a page
// reload so the customer keeps their place in the list, same busy-button treatment.
export function AddToCartButton({ productId, quantity = 1 }: { productId: number; quantity?: number }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function handleClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(json.message || "Added to your cart.");
        router.refresh();
      } else {
        toast.error(json.message || "We could not add that item.");
      }
    } catch {
      toast.error("We could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={`btn btn-wood btn-sm${busy ? " is-busy" : ""}`} disabled={busy} onClick={handleClick}>
      {busy && <span className="wos-btn-spinner" aria-hidden="true" />}
      {busy ? "Adding..." : "Add to Cart"}
    </button>
  );
}
