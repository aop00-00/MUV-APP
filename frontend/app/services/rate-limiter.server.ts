// app/services/rate-limiter.server.ts
// ─────────────────────────────────────────────────────────────────────────────
// In-memory sliding window rate limiter for React Router 7 SSR.
//
// MVP: uses a module-level Map. Works correctly for single-instance deploys
// (Vercel serverless warm instances). For multi-instance production, swap
// the store for Upstash Redis (see TODO comments).
//
// Usage in a loader/action:
//   const limit = checkRateLimit(gymId, planId, "default");
//   if (!limit.allowed) return rateLimitResponse(limit);
// ─────────────────────────────────────────────────────────────────────────────

import type { PlanId } from "~/services/plan-limits.server";

// ─── Config ─────────────────────────────────────────────────────────────────

const RATE_LIMITS_PER_MINUTE: Record<PlanId, number> = {
  emprendedor: 30,
  starter:     120,
  pro:         300,
  elite:       600,
};

const RATE_LIMITS_PER_HOUR: Record<PlanId, number> = {
  emprendedor: 500,
  starter:     3_000,
  pro:         10_000,
  elite:       30_000,
};

// Strict write limits for sensitive endpoints (per HOUR, Emprendedor only)
type WriteEndpoint = "bookings" | "members" | "orders" | "classes";

const WRITE_LIMITS_EMPRENDEDOR: Record<WriteEndpoint, number> = {
  bookings: 10,
  members:  5,
  orders:   10,
  classes:  5,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  minuteWindow: number[];   // timestamps (ms) within last 60 s
  hourWindow:   number[];   // timestamps (ms) within last 3600 s
}

export interface RateLimitResult {
  allowed:           boolean;
  remaining_minute:  number;
  remaining_hour:    number;
  retry_after_seconds: number;
}

// ─── In-memory store ─────────────────────────────────────────────────────────
// TODO: replace with Upstash Redis for multi-instance Vercel deploys.
// import { Redis } from "@upstash/redis";

const store = new Map<string, RateLimitEntry>();

const MINUTE_MS = 60_000;
const HOUR_MS   = 3_600_000;

function getEntry(key: string): RateLimitEntry {
  if (!store.has(key)) {
    store.set(key, { minuteWindow: [], hourWindow: [] });
  }
  return store.get(key)!;
}

function pruneWindow(timestamps: number[], windowMs: number, now: number): number[] {
  return timestamps.filter((t) => now - t < windowMs);
}

// Cleanup old entries every ~5 minutes to prevent memory leaks
let lastCleanup = Date.now();
function maybeCleanup(now: number) {
  if (now - lastCleanup < 5 * MINUTE_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    entry.minuteWindow = pruneWindow(entry.minuteWindow, MINUTE_MS, now);
    entry.hourWindow   = pruneWindow(entry.hourWindow, HOUR_MS, now);
    if (entry.minuteWindow.length === 0 && entry.hourWindow.length === 0) {
      store.delete(key);
    }
  }
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Check and record a request against the rate limit for a gym.
 *
 * @param gymId   - The gym's UUID
 * @param planId  - The gym's plan tier
 * @param endpoint - Logical endpoint name (e.g. "default", "members", "orders")
 */
export function checkRateLimit(
  gymId: string,
  planId: PlanId,
  endpoint: string = "default",
): RateLimitResult {
  const now       = Date.now();
  const key       = `${gymId}:${endpoint}`;
  const entry     = getEntry(key);

  maybeCleanup(now);

  // Prune stale timestamps
  entry.minuteWindow = pruneWindow(entry.minuteWindow, MINUTE_MS, now);
  entry.hourWindow   = pruneWindow(entry.hourWindow, HOUR_MS, now);

  const limitMinute = RATE_LIMITS_PER_MINUTE[planId] ?? 60;
  const limitHour   = RATE_LIMITS_PER_HOUR[planId]   ?? 1000;

  // Check write limits for emprendedor on sensitive endpoints
  let limitWrite: number | null = null;
  if (planId === "emprendedor" && endpoint in WRITE_LIMITS_EMPRENDEDOR) {
    limitWrite = WRITE_LIMITS_EMPRENDEDOR[endpoint as WriteEndpoint];
  }

  const countMinute = entry.minuteWindow.length;
  const countHour   = entry.hourWindow.length;

  const blockedByMinute = countMinute >= limitMinute;
  const blockedByHour   = countHour   >= limitHour;
  const blockedByWrite  = limitWrite !== null && countHour >= limitWrite;

  const allowed = !blockedByMinute && !blockedByHour && !blockedByWrite;

  if (allowed) {
    entry.minuteWindow.push(now);
    entry.hourWindow.push(now);
  }

  // Retry-after: time until oldest request leaves the blocking window
  let retryAfter = 60;
  if (blockedByMinute && entry.minuteWindow.length > 0) {
    retryAfter = Math.ceil((entry.minuteWindow[0]! + MINUTE_MS - now) / 1000);
  } else if ((blockedByHour || blockedByWrite) && entry.hourWindow.length > 0) {
    retryAfter = Math.ceil((entry.hourWindow[0]! + HOUR_MS - now) / 1000);
  }

  return {
    allowed,
    remaining_minute:     Math.max(0, limitMinute - countMinute - (allowed ? 1 : 0)),
    remaining_hour:       Math.max(0, limitHour   - countHour   - (allowed ? 1 : 0)),
    retry_after_seconds:  allowed ? 0 : retryAfter,
  };
}

/**
 * Returns a 429 Response with rate limit details.
 * Use this in loaders/actions after checkRateLimit returns allowed=false.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error:               "rate_limit_exceeded",
      message:             "Has excedido el límite de solicitudes. Intenta de nuevo en unos minutos.",
      retry_after_seconds: result.retry_after_seconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type":      "application/json",
        "Retry-After":       String(result.retry_after_seconds),
        "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + result.retry_after_seconds),
      },
    },
  );
}
