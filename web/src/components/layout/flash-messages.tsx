"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { FLASH_COOKIE_PREFIX, type FlashTone } from "@/lib/flash-constants";

export function FlashMessages({ flashes }: { flashes: { tone: FlashTone; message: string }[] }) {
  const toast = useToast();

  useEffect(() => {
    for (const f of flashes) {
      toast.show(f.tone, f.message);
      // Clearing here (a plain browser API, not next/headers' cookies()) is what actually
      // removes the cookie — the server-side read in RootLayout is deliberately read-only, see
      // lib/flash.ts's comment for why. Expire it immediately rather than waiting out its 30s
      // maxAge, so the same toast can't replay on the next navigation within that window. The
      // Secure attribute must match how the cookie was originally set (lib/flash.ts sets it
      // whenever NODE_ENV is production) for the browser to actually delete it, not just shadow
      // it with a second, non-Secure cookie of the same name.
      const secureAttr = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${FLASH_COOKIE_PREFIX}${f.tone}=; path=/; max-age=0${secureAttr}`;
    }
    // Intentionally run once per server render (flashes array identity changes each request).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashes]);

  return null;
}
