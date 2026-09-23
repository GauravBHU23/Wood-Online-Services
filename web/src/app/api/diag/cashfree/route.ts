import { NextResponse } from "next/server";
import * as cashfree from "@/lib/payments/cashfree";

// TEMPORARY diagnostic route — reports whether Cashfree env vars are actually set on this
// deployment, WITHOUT ever revealing their values (only booleans/lengths), so a live "online
// payment unavailable" report can be root-caused without needing dashboard/UI access. Delete
// this route once the live-mode env var issue is confirmed fixed — it is not meant to ship
// long-term, even though it leaks no secrets.
export async function GET() {
  const mode = process.env.CASHFREE_MODE ?? null;
  const hasClientId = !!process.env.CASHFREE_CLIENT_ID;
  const hasClientSecret = !!process.env.CASHFREE_CLIENT_SECRET;
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? null;

  return NextResponse.json({
    CASHFREE_MODE: mode,
    CASHFREE_CLIENT_ID_set: hasClientId,
    CASHFREE_CLIENT_ID_length: process.env.CASHFREE_CLIENT_ID?.length ?? 0,
    CASHFREE_CLIENT_SECRET_set: hasClientSecret,
    CASHFREE_CLIENT_SECRET_length: process.env.CASHFREE_CLIENT_SECRET?.length ?? 0,
    NEXT_PUBLIC_SITE_URL: siteBaseUrl,
    isEnabled: cashfree.isEnabled(),
    isUsable: cashfree.isUsable(),
    liveConfigurationProblem: cashfree.liveConfigurationProblem(),
  });
}
