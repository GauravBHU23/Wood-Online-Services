import { headers } from "next/headers";

/** Ported from Services/ClientIpHelper.cs — X-Forwarded-For first (the real origin behind any proxy). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
