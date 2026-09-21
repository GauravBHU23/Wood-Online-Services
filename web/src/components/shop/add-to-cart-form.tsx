"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

// Ported from the quantity stepper + Add to Cart form on Views/Shop/Details.cshtml
// (data-qty-step buttons from wwwroot/js/site.js).
export function AddToCartForm({ productId, maxQuantity, whatsappHref }: { productId: number; maxQuantity: number; whatsappHref: string }) {
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function step(delta: number) {
    setQuantity((q) => Math.min(maxQuantity, Math.max(1, q + delta)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="d-flex flex-wrap gap-2 align-items-center">
      <div className="input-group" style={{ width: 160 }}>
        <button className="btn btn-outline-wood" type="button" onClick={() => step(-1)} aria-label="Decrease quantity">
          &minus;
        </button>
        <input
          type="number"
          value={quantity}
          min={1}
          max={maxQuantity}
          className="form-control text-center"
          aria-label="Quantity"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setQuantity(Math.min(maxQuantity, Math.max(1, n)));
          }}
        />
        <button className="btn btn-outline-wood" type="button" onClick={() => step(1)} aria-label="Increase quantity">
          +
        </button>
      </div>

      <button type="submit" className={`btn btn-wood btn-lg${busy ? " is-busy" : ""}`} disabled={busy}>
        {busy && <span className="wos-btn-spinner" aria-hidden="true" />}
        {busy ? "Adding..." : "Add to Cart"}
      </button>

      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp btn-lg">
        WhatsApp
      </a>
    </form>
  );
}
