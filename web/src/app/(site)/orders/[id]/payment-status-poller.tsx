"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";

/** Polls while a UPI/bank confirmation is still settling after the callback redirect. */
export function PaymentStatusPoller({ orderId }: { orderId: number }) {
  const router = useRouter();
  const toast = useToast();
  const attemptsRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      attemptsRef.current += 1;
      if (attemptsRef.current > 20) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await fetch(`/api/payment/status/${orderId}`);
        const json = await res.json();
        if (json.success && json.data?.isPaid) {
          clearInterval(interval);
          toast.success("Payment confirmed!");
          router.refresh();
        }
      } catch {
        // Keep trying silently — this is a background poll.
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [orderId, router, toast]);

  return null;
}
