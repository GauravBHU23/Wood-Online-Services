"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction } from "@/lib/orders/actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";

export function CancelOrderButton({ orderId }: { orderId: number }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();

  async function handleClick() {
    const ok = await confirm({ title: "Cancel order", message: "Are you sure you want to cancel this order?", tone: "danger", confirmLabel: "Cancel Order" });
    if (!ok) return;

    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <button type="button" className={`btn btn-outline-danger w-100${pending ? " is-busy" : ""}`} disabled={pending} onClick={handleClick}>
      {pending ? "Cancelling..." : "Cancel Order"}
    </button>
  );
}
