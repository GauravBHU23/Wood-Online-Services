"use client";

import { useEffect } from "react";
import { recordProductView } from "@/lib/client/recently-viewed";

export function TrackProductView({ productId }: { productId: number }) {
  useEffect(() => {
    recordProductView(productId);
  }, [productId]);

  return null;
}
