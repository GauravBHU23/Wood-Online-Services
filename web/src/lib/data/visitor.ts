import "server-only";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

// Ported from Services/VisitorService.cs. Powers the footer badge: total visit count plus the
// caller's OWN address and location only — one visitor can never see another visitor's IP
// through this. The footer is decoration; a failure here must never take a page down.

const SESSION_COOKIE = "wos_vid";
const GEO_CACHE = new Map<string, { value: GeoResult | null; expiresAt: number }>();

interface GeoResult {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

export interface VisitorInfo {
  ipAddress: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  totalVisits: number;
}

export function locationLabel(info: Pick<VisitorInfo, "city" | "region" | "country">): string {
  const parts = [info.city, info.region, info.country].filter((p): p is string => !!p && p.trim().length > 0);
  const unique = Array.from(new Set(parts.map((p) => p.toLowerCase()))).map(
    (lower) => parts.find((p) => p.toLowerCase() === lower)!
  );
  return unique.length > 0 ? unique.join(", ") : "Unknown location";
}

/** Resolves the caller's address, preferring the proxy headers a platform sets. */
export async function getVisitorIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    let first = forwarded.split(",")[0].trim();
    // Some platforms append the source port, e.g. "203.0.113.4:51234".
    const colonCount = (first.match(/:/g) ?? []).length;
    if (colonCount === 1) first = first.slice(0, first.lastIndexOf(":"));
    if (isValidIp(first)) return first;
  }
  const real = h.get("x-real-ip");
  if (real && isValidIp(real.trim())) return real.trim();
  return "0.0.0.0";
}

function isValidIp(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) || /^[0-9a-fA-F:]+$/.test(value);
}

function isPrivateAddress(ip: string): boolean {
  if (ip === "0.0.0.0" || ip === "unknown") return true;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) {
    return ip === "::1" || ip.startsWith("fe80") || ip.startsWith("fc") || ip.startsWith("fd");
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

async function getGeoLocation(ip: string, enabled: boolean): Promise<GeoResult | null> {
  if (!enabled || isPrivateAddress(ip)) return null;

  const cached = GEO_CACHE.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const json = await res.json();

    if (json.status !== "success") {
      GEO_CACHE.set(ip, { value: null, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
      return null;
    }

    const result: GeoResult = {
      city: json.city ?? null,
      region: json.regionName ?? null,
      country: json.country ?? null,
      countryCode: json.countryCode ?? null,
    };
    GEO_CACHE.set(ip, { value: result, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return result;
  } catch {
    return null;
  }
}

export async function trackAndGetVisitor(
  featureEnabled: boolean,
  geoEnabled: boolean,
  landingPage: string
): Promise<VisitorInfo> {
  const ip = await getVisitorIp();

  if (!featureEnabled) {
    return { ipAddress: ip, city: null, region: null, country: null, countryCode: null, totalVisits: 0 };
  }

  try {
    const cookieStore = await cookies();
    const isNewSession = !cookieStore.get(SESSION_COOKIE);
    if (isNewSession) {
      cookieStore.set(SESSION_COOKIE, crypto.randomUUID().replace(/-/g, ""), {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
    }

    const geo = await getGeoLocation(ip, geoEnabled);
    const total = await recordVisit(ip, geo, isNewSession, landingPage);

    return {
      ipAddress: ip,
      city: geo?.city ?? null,
      region: geo?.region ?? null,
      country: geo?.country ?? null,
      countryCode: geo?.countryCode ?? null,
      totalVisits: total,
    };
  } catch {
    return { ipAddress: ip, city: null, region: null, country: null, countryCode: null, totalVisits: 0 };
  }
}

async function recordVisit(
  ip: string,
  geo: GeoResult | null,
  isNewSession: boolean,
  landingPage: string
): Promise<number> {
  const admin = createAdminClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const existingResult = await admin
    .from("visitor_logs")
    .select("id, page_views")
    .eq("ip_address", ip)
    .gte("first_seen", todayStart.toISOString())
    .maybeSingle();
  const existing = existingResult.data as { id: number; page_views: number } | null;

  if (existing) {
    const patch: Database["public"]["Tables"]["visitor_logs"]["Update"] = {
      last_seen: new Date().toISOString(),
      page_views: existing.page_views + 1,
    };
    await admin.from("visitor_logs").update(patch).eq("id", existing.id);
  } else {
    const insert: Database["public"]["Tables"]["visitor_logs"]["Insert"] = {
      ip_address: ip,
      city: geo?.city ?? null,
      region: geo?.region ?? null,
      country: geo?.country ?? null,
      country_code: geo?.countryCode ?? null,
      landing_page: landingPage.slice(0, 300),
    };
    await admin.from("visitor_logs").insert(insert);
  }

  const counterResult = await admin.from("visitor_counter").select("id, total_visits, total_page_views").limit(1).maybeSingle();
  const counter = counterResult.data as { id: number; total_visits: number; total_page_views: number } | null;

  if (!counter) {
    const insert: Database["public"]["Tables"]["visitor_counter"]["Insert"] = {
      total_visits: isNewSession ? 1 : 0,
      total_page_views: 1,
    };
    await admin.from("visitor_counter").insert(insert);
    return isNewSession ? 1 : 0;
  }

  const newTotalVisits = counter.total_visits + (isNewSession ? 1 : 0);
  const patch: Database["public"]["Tables"]["visitor_counter"]["Update"] = {
    total_visits: newTotalVisits,
    total_page_views: counter.total_page_views + 1,
    last_updated: new Date().toISOString(),
  };
  await admin.from("visitor_counter").update(patch).eq("id", counter.id);

  return newTotalVisits;
}
