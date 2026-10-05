"use client";

// Tracks the last few viewed product IDs in localStorage — no account needed, same convention
// as cart/session cookies elsewhere in the app being the lightweight, no-dependency choice.
const STORAGE_KEY = "wos_recently_viewed";
const MAX_ITEMS = 10;

export function recordProductView(productId: number): void {
  try {
    const ids = readViewedIds().filter((id) => id !== productId);
    ids.unshift(productId);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage can throw (private browsing, quota, disabled) — this feature is decorative.
  }
}

export function readViewedIds(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}
