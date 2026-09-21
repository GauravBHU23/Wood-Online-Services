"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast-provider";
import type { FlashTone } from "@/lib/flash";

export function FlashMessages({ flashes }: { flashes: { tone: FlashTone; message: string }[] }) {
  const toast = useToast();

  useEffect(() => {
    for (const f of flashes) toast.show(f.tone, f.message);
    // Intentionally run once per server render (flashes array identity changes each request).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashes]);

  return null;
}
