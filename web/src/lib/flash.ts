import { cookies } from "next/headers";

// Replaces ASP.NET's TempData["Success"/"Error"/"Warning"/"Info"]. A Server Action sets one of
// these short-lived cookies right before redirecting; the layout reads and clears it on the
// next render and replays it as a toast (see components/layout/flash-messages.tsx).

export type FlashTone = "success" | "error" | "warning" | "info";

const COOKIE_PREFIX = "wos_flash_";

export async function setFlash(tone: FlashTone, message: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${COOKIE_PREFIX}${tone}`, message, {
    httpOnly: false, // read by nothing client-side; kept non-httpOnly only so it's simple to clear via document.cookie as a fallback
    sameSite: "lax",
    maxAge: 30,
    path: "/",
  });
}

export async function readAndClearFlashes(): Promise<{ tone: FlashTone; message: string }[]> {
  const cookieStore = await cookies();
  const tones: FlashTone[] = ["success", "error", "warning", "info"];
  const found: { tone: FlashTone; message: string }[] = [];

  for (const tone of tones) {
    const name = `${COOKIE_PREFIX}${tone}`;
    const value = cookieStore.get(name)?.value;
    if (value) {
      found.push({ tone, message: value });
      cookieStore.delete(name);
    }
  }

  return found;
}
