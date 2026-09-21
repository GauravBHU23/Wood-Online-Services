import "server-only";

// Ported from Services/SuspiciousActivityService.cs. Flags credential-stuffing-style behaviour:
// many failed logins from one IP in a short window, regardless of which account each attempt
// targeted (per-account lockout alone misses this, since an attacker trying ten different
// emails never fails the same account three times).
//
// Tracked in a process-local Map, same scope as the original's IMemoryCache — this is
// short-lived, high-frequency data that doesn't need to survive a restart. NOTE: on a
// multi-instance/serverless deployment this resets per instance and is not shared; that is an
// accepted limitation carried over from the original (also single-instance-scoped), not a new
// gap introduced by this port. If deployed behind multiple Node instances, replace with a
// shared store (Upstash Redis, or a Postgres table) keyed the same way.

const FAILURE_THRESHOLD = 10;
const TRACKING_WINDOW_MS = 10 * 60 * 1000;

interface Entry {
  count: number;
  expiresAt: number;
}

interface Block {
  until: number;
}

const counts = new Map<string, Entry>();
const blocks = new Map<string, Block>();

function prune() {
  const now = Date.now();
  for (const [ip, e] of counts) if (e.expiresAt <= now) counts.delete(ip);
  for (const [ip, b] of blocks) if (b.until <= now) blocks.delete(ip);
}

export function isBlocked(ip: string): boolean {
  prune();
  return blocks.has(ip);
}

export function minutesRemaining(ip: string): number {
  const block = blocks.get(ip);
  if (!block) return 0;
  return Math.max(0, Math.ceil((block.until - Date.now()) / 60000));
}

export function recordFailedAttempt(ip: string, lockoutMinutes: number): void {
  prune();
  const existing = counts.get(ip);
  const count = (existing?.count ?? 0) + 1;
  counts.set(ip, { count, expiresAt: Date.now() + TRACKING_WINDOW_MS });

  if (count >= FAILURE_THRESHOLD) {
    blocks.set(ip, { until: Date.now() + lockoutMinutes * 60000 });
    counts.delete(ip);
  }
}

export function recordSuccess(ip: string): void {
  counts.delete(ip);
}
