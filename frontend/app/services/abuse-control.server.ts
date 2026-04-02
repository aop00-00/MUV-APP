// app/services/abuse-control.server.ts
// ─────────────────────────────────────────────────────────────────────────────
// Anti-abuse controls for registration:
//   - IP-based registration rate limiting (max 2 free accounts / IP / 30 days)
//   - Email hash deduplication
//   - Abuse event logging
//
// For REG-003 (IP limit) — replaces Twilio OTP as MVP verification mechanism.
// Fastest and most effective for LATAM where disposable phone numbers are common.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "~/services/supabase.server";
import { createHash } from "node:crypto";

export interface RegistrationData {
  gymId:   string;
  email:   string;
  ipAddress: string;
  deviceFingerprint?: string;
}

export interface AbuseEventData {
  gymId?:      string;
  userId?:     string;
  eventType:   "rate_limit_hit" | "cap_reached" | "registration_blocked" | "suspicious_activity" | "inactivity_warning" | "account_archived";
  eventDetail: Record<string, unknown>;
  ipAddress?:  string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashValue(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

const MAX_ACCOUNTS_PER_IP = 2;
const WINDOW_DAYS          = 30;

// ─── IP rate limit check ──────────────────────────────────────────────────────

/**
 * Checks if an IP address has exceeded the maximum number of free plan registrations.
 * Returns { allowed: true } or { allowed: false, reason }
 */
export async function checkIpRegistrationLimit(
  ipAddress: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1") {
    return { allowed: true }; // Never block localhost (dev)
  }

  try {
    const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("abuse_controls")
      .select("id, registros_desde_ip")
      .eq("ip_registro", ipAddress)
      .gte("created_at", windowStart);

    if (error) {
      console.error("[abuse-control] IP check error:", error);
      return { allowed: true }; // Fail open — don't block legitimate users on DB error
    }

    const totalFromIp = data?.length ?? 0;
    if (totalFromIp >= MAX_ACCOUNTS_PER_IP) {
      return {
        allowed: false,
        reason:  "ip_limit_exceeded",
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error("[abuse-control] Unexpected IP check error:", err);
    return { allowed: true }; // Fail open
  }
}

// ─── Record successful registration ──────────────────────────────────────────

/**
 * Records a new registration in abuse_controls table.
 * Call AFTER the user has been successfully created.
 */
export async function recordRegistration(data: RegistrationData): Promise<void> {
  try {
    const emailHash = hashValue(data.email);

    // Check if this IP already has records — if so, increment counter
    const { data: existing } = await supabaseAdmin
      .from("abuse_controls")
      .select("id, registros_desde_ip")
      .eq("ip_registro", data.ipAddress)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Increment IP counter
      await supabaseAdmin
        .from("abuse_controls")
        .update({
          registros_desde_ip: (existing.registros_desde_ip ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      // New IP — insert record
      await supabaseAdmin.from("abuse_controls").insert({
        gym_id:              data.gymId,
        email_hash:          emailHash,
        ip_registro:         data.ipAddress,
        device_fingerprint:  data.deviceFingerprint ?? null,
        registros_desde_ip:  1,
        flagged:             false,
      });
    }
  } catch (err) {
    // Non-blocking — never fail registration because of this
    console.error("[abuse-control] recordRegistration error (non-blocking):", err);
  }
}

// ─── Abuse event logging ──────────────────────────────────────────────────────

/**
 * Logs an abuse event to the abuse_events table.
 * Always non-blocking — errors are logged but never rethrown.
 */
export async function logAbuseEvent(event: AbuseEventData): Promise<void> {
  try {
    await supabaseAdmin.from("abuse_events").insert({
      gym_id:       event.gymId    ?? null,
      user_id:      event.userId   ?? null,
      event_type:   event.eventType,
      event_detail: event.eventDetail,
      ip_address:   event.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[abuse-control] logAbuseEvent error (non-blocking):", err);
  }
}

// ─── Helper: extract client IP from request ───────────────────────────────────

/**
 * Extracts the real client IP from the request headers.
 * Handles Vercel's X-Forwarded-For and CF-Connecting-IP headers.
 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();

  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";

  return "unknown";
}
