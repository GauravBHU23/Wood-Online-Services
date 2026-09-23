// Pulled out of flash.ts so a Client Component (flash-messages.tsx) can import the cookie prefix
// and FlashTone type without pulling in flash.ts's `next/headers` import — a server-only module
// that Next.js refuses to include in any client bundle at all, even for the parts of it that
// don't actually touch cookies().

export type FlashTone = "success" | "error" | "warning" | "info";
export const FLASH_COOKIE_PREFIX = "wos_flash_";
