import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE_PREFIX, type FlashTone } from "@/lib/flash-constants";

// Replaces ASP.NET's TempData["Success"/"Error"/"Warning"/"Info"]. A Server Action sets one of
// these short-lived cookies right before redirecting; the root layout reads (never writes) it on
// the next render and replays it as a toast (see components/layout/flash-messages.tsx), which
// then clears the cookie itself client-side once it has shown the toast.
//
// The read used to also delete the cookie server-side, from inside RootLayout's render body —
// but RootLayout wraps every route, and a cookie *write* (delete counts) is only legal from a
// Server Action or Route Handler, never a plain page/layout render. Any flash actually pending
// (i.e. right after any redirect that calls setFlash — precisely when a customer lands on
// /orders/[id] or /checkout/success right after the payment callback) crashed every single page
// in the app with "Cookies can only be modified in a Server Action or Route Handler". Read-only
// here; FlashMessages' own useEffect clears the cookie via document.cookie instead, which has no
// such restriction since it's a plain browser API running client-side.

export type { FlashTone };
const FLASH_TONES: FlashTone[] = ["success", "error", "warning", "info"];

export async function setFlash(tone: FlashTone, message: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${FLASH_COOKIE_PREFIX}${tone}`, message, {
    httpOnly: false, // must be readable/clearable from document.cookie client-side (see above)
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30,
    path: "/",
  });
}

/** Read-only — safe to call from any Server Component render, including the root layout. */
export async function readFlashes(): Promise<{ tone: FlashTone; message: string }[]> {
  const cookieStore = await cookies();
  const found: { tone: FlashTone; message: string }[] = [];

  for (const tone of FLASH_TONES) {
    const value = cookieStore.get(`${FLASH_COOKIE_PREFIX}${tone}`)?.value;
    if (value) found.push({ tone, message: value });
  }

  return found;
}
