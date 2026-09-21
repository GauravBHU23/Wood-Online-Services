"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearCartAction } from "@/lib/cart/actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";

export function ClearCartButton() {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();

  async function handleClick() {
    const ok = await confirm({ title: "Clear cart", message: "Empty your entire cart?", tone: "danger", confirmLabel: "Clear Cart" });
    if (!ok) return;

    startTransition(async () => {
      await clearCartAction();
      toast.success("Your cart has been emptied.");
      router.refresh();
    });
  }

  return (
    <button type="button" className={`btn btn-sm btn-outline-danger${pending ? " is-busy" : ""}`} disabled={pending} onClick={handleClick}>
      {pending ? "Clearing..." : "Clear Cart"}
    </button>
  );
}
