// Minimal, dependency-free User-Agent parsing for the "new sign-in" security email — good enough
// to name the common browsers/OSes/device types without pulling in a whole UA-parsing library for
// what's ultimately a best-effort, cosmetic detail in one email. Order matters in each list: more
// specific patterns (Edge, which also contains "Chrome" in its UA string) must be checked before
// the more general ones they'd otherwise be mistaken for.

export interface DeviceInfo {
  browser: string;
  os: string;
  deviceType: "Mobile" | "Tablet" | "Desktop";
}

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/EdgA?\//i, "Microsoft Edge"],
  [/OPR\//i, "Opera"],
  [/SamsungBrowser\//i, "Samsung Internet"],
  [/CriOS\//i, "Chrome"], // Chrome on iOS
  [/FxiOS\//i, "Firefox"], // Firefox on iOS
  [/Firefox\//i, "Firefox"],
  [/Chrome\//i, "Chrome"],
  [/Version\/.*Safari\//i, "Safari"],
  [/Safari\//i, "Safari"],
  [/MSIE |Trident\//i, "Internet Explorer"],
];

const OS_PATTERNS: [RegExp, string][] = [
  [/Windows NT 10\.0/i, "Windows 10/11"],
  [/Windows NT/i, "Windows"],
  [/Mac OS X/i, "macOS"],
  [/CrOS/i, "Chrome OS"],
  [/Android/i, "Android"],
  [/iPhone|iPad|iPod/i, "iOS"],
  [/Linux/i, "Linux"],
];

export function parseUserAgent(userAgent: string | null): DeviceInfo {
  const ua = userAgent ?? "";

  const browser = BROWSER_PATTERNS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Unknown browser";
  const os = OS_PATTERNS.find(([pattern]) => pattern.test(ua))?.[1] ?? "Unknown OS";

  let deviceType: DeviceInfo["deviceType"] = "Desktop";
  if (/iPad|Tablet(?!.*Mobile)/i.test(ua)) deviceType = "Tablet";
  else if (/Mobi|Android.*Mobile|iPhone/i.test(ua)) deviceType = "Mobile";

  return { browser, os, deviceType };
}
