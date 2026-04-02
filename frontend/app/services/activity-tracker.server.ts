// app/services/activity-tracker.server.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tracks gym activity to support inactivity archiving (INACT-001).
//
// Call updateGymActivity() in any loader/action that represents "real" usage:
//   - Admin login
//   - Create/edit class or booking
//   - Process POS order
//   - Register member
//   - Check-in
//
// Always non-blocking — errors are logged but never thrown.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "~/services/supabase.server";

/**
 * Updates last_activity_at for the gym.
 * Debounced: only writes to DB if last update was > 5 minutes ago
 * (checked in-memory — saves unnecessary DB writes on busy gyms).
 */
const lastActivityCache = new Map<string, number>();
const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

export async function updateGymActivity(gymId: string): Promise<void> {
  if (!gymId) return;

  const now  = Date.now();
  const last = lastActivityCache.get(gymId) ?? 0;

  if (now - last < DEBOUNCE_MS) return; // Already updated recently

  lastActivityCache.set(gymId, now);

  try {
    await supabaseAdmin
      .from("gyms")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", gymId);
  } catch (err) {
    // Non-blocking — never fail the request because of this
    console.error("[activity-tracker] updateGymActivity error (non-blocking):", err);
  }
}

// ─── Inactivity check (called by Vercel Cron) ────────────────────────────────

export interface InactiveGym {
  id:              string;
  name:            string;
  owner_id:        string | null;
  last_activity_at: string | null;
  days_inactive:   number;
  gym_status:      string;
}

/**
 * Returns gyms that are inactive according to the given threshold (in days).
 * Only checks gyms with plan_id = 'emprendedor' and gym_status = 'active'.
 */
export async function getInactiveGyms(thresholdDays: number): Promise<InactiveGym[]> {
  const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("gyms")
    .select("id, name, owner_id, last_activity_at, gym_status")
    .eq("plan_id", "emprendedor")
    .eq("gym_status", "active")
    .or(`last_activity_at.lte.${cutoff},last_activity_at.is.null`)
    .order("last_activity_at", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("[activity-tracker] getInactiveGyms error:", error);
    return [];
  }

  return (data ?? []).map((gym) => {
    const lastActivity = gym.last_activity_at
      ? new Date(gym.last_activity_at).getTime()
      : 0;
    const daysInactive = Math.floor((Date.now() - lastActivity) / (24 * 60 * 60 * 1000));
    return { ...gym, days_inactive: daysInactive };
  });
}

/**
 * Archives a gym (sets gym_status = 'archived').
 * The gym owner can reactivate instantly by logging in again.
 */
export async function archiveGym(gymId: string): Promise<void> {
  await supabaseAdmin
    .from("gyms")
    .update({ gym_status: "archived" })
    .eq("id", gymId);
}

/**
 * Soft-deletes a gym (sets gym_status = 'deleted_soft').
 * Data is preserved in DB but inaccessible to users.
 * A manual admin action is required for permanent deletion.
 */
export async function softDeleteGym(gymId: string): Promise<void> {
  await supabaseAdmin
    .from("gyms")
    .update({ gym_status: "deleted_soft" })
    .eq("id", gymId);
}
