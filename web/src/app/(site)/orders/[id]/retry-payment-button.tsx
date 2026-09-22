"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryPaymentAction } from "@/lib/payments/actions";
import { useToast } from "@/components/ui/toast-provider";

export function RetryPaymentButton({ orderId }: { orderId: number }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleClick() {
    startTransition(async () => {
      const result = await retryPaymentAction(orderId);
      if (result.redirectTo) {
        if (!result.success) toast.error(result.message ?? "Could not start the payment.");
        router.push(result.redirectTo);
      } else {
        toast.error(result.message ?? "Could not start the payment.");
      }
    });
  }

  return (
    <button type="button" className={`btn btn-wood btn-sm${pending ? " is-busy" : ""}`} disabled={pending} onClick={handleClick}>
      {pending && <span className="wos-btn-spinner" aria-hidden="true" />}
      {pending ? "Opening payment..." : "Retry Payment"}
    </button>
  );
}
