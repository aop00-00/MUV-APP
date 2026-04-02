// app/services/onboarding.server.ts
// Service layer for adaptive post-checkout onboarding system

import { supabaseAdmin } from "./supabase.server";
import type { StudioType, BookingMode, LayoutConfig, OnboardingProgress } from "~/types/database";

// Custom response helpers (avoid react-router named exports for Vercel SSR)
const json = (data: any, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });

const redirect = (url: string, init?: number | ResponseInit) => {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return new Response(null, {
    status: responseInit?.status ?? 302,
    ...responseInit,
    headers: { Location: url, ...responseInit?.headers }
  });
};

/**
 * Get onboarding progress for a gym
 *
 * Used by layout loader to determine which step to display
 * and by route loaders to fetch booking_mode for adaptive UI
 *
 * @param gymId - Gym UUID
 * @returns Current onboarding progress state
 */
export async function getOnboardingProgress(gymId: string): Promise<OnboardingProgress> {
  const { data: gym, error } = await supabaseAdmin
    .from("gyms")
    .select("onboarding_step, onboarding_completed, studio_type, booking_mode")
    .eq("id", gymId)
    .single();

  if (error || !gym) {
    console.error(`[onboarding.server] Failed to fetch progress for gym ${gymId}:`, error);
    throw new Error("Gym not found");
  }

  return {
    current_step: gym.onboarding_step || 0,
    completed_steps: [], // Could track individual step completion if needed
    studio_type: gym.studio_type,
    booking_mode: gym.booking_mode || 'capacity_only',
  };
}

/**
 * Update onboarding step progress
 *
 * Called by each step's action to track progress.
 * Allows user to resume onboarding after browser close.
 *
 * @param gymId - Gym UUID
 * @param step - Step number (0-7)
 */
export async function updateOnboardingStep(gymId: string, step: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("gyms")
    .update({ onboarding_step: step })
    .eq("id", gymId);

  if (error) {
    console.error(`[onboarding.server] Failed to update step for gym ${gymId}:`, error);
    throw new Error(`Failed to update onboarding step: ${error.message}`);
  }
}

/**
 * Save studio type and derive booking mode
 *
 * Step 2 of onboarding. Maps studio type to booking mode:
 * - Pilates/Cycling → assigned_resource (seat selection)
 * - Yoga/Barre/Dance → capacity_only (simple count)
 * - HIIT/Martial → capacity_or_none (gym chooses limit or unlimited)
 *
 * @param gymId - Gym UUID
 * @param studioType - Selected studio type
 * @returns Derived booking mode
 */
export async function saveStudioType(gymId: string, studioType: StudioType): Promise<BookingMode> {
  // Mapping: studio type → booking mode
  const bookingModeMap: Record<StudioType, BookingMode> = {
    pilates: 'assigned_resource',
    cycling: 'assigned_resource',
    yoga: 'capacity_only',
    barre: 'capacity_only',
    dance: 'capacity_only',
    hiit: 'capacity_or_none',
    martial: 'capacity_or_none',
  };

  const bookingMode = bookingModeMap[studioType];

  const { error } = await supabaseAdmin
    .from("gyms")
    .update({
      studio_type: studioType,
      booking_mode: bookingMode,
      onboarding_step: 2, // Advance to Identity step
    })
    .eq("id", gymId);

  if (error) {
    console.error(`[onboarding.server] Failed to save studio type for gym ${gymId}:`, error);
    throw new Error(`Failed to save studio type: ${error.message}`);
  }

  console.log(`[onboarding.server] Gym ${gymId} studio_type=${studioType}, booking_mode=${bookingMode}`);
  return bookingMode;
}

/**
 * Save brand identity (logo, color)
 *
 * Step 3 of onboarding. Updates gym branding preferences.
 *
 * @param gymId - Gym UUID
 * @param data - Branding data (brand_color, logo_url)
 */
export async function saveBrandIdentity(
  gymId: string,
  data: { brand_color?: string; logo_url?: string }
): Promise<void> {
  const updates: any = { onboarding_step: 3 }; // Advance to Room step

  if (data.brand_color) updates.brand_color = data.brand_color;
  if (data.logo_url) updates.logo_url = data.logo_url;

  const { error } = await supabaseAdmin
    .from("gyms")
    .update(updates)
    .eq("id", gymId);

  if (error) {
    console.error(`[onboarding.server] Failed to save brand identity for gym ${gymId}:`, error);
    throw new Error(`Failed to save brand identity: ${error.message}`);
  }

  console.log(`[onboarding.server] Gym ${gymId} brand identity updated`);
}

/**
 * Save room layout (for assigned_resource mode)
 *
 * Step 4 of onboarding (assigned_resource variant).
 * Creates resource records and saves layout configuration.
 *
 * @param gymId - Gym UUID
 * @param roomId - Room UUID (or use default room)
 * @param layout - Layout configuration (rows, cols, resources)
 */
export async function saveRoomLayout(
  gymId: string,
  roomId: string | null,
  layout: LayoutConfig
): Promise<void> {
  // 1. Save layout_config to gyms table
  const { error: gymError } = await supabaseAdmin
    .from("gyms")
    .update({
      layout_config: layout,
      default_capacity: layout.resources?.length || 0, // Capacity = number of resources
      onboarding_step: 4, // Advance to Classes step
    })
    .eq("id", gymId);

  if (gymError) {
    console.error(`[onboarding.server] Failed to save layout config for gym ${gymId}:`, gymError);
    throw new Error(`Failed to save layout: ${gymError.message}`);
  }

  // 2. Create resource records in resources table
  if (layout.resources && layout.resources.length > 0) {
    const resourceRecords = layout.resources.map(r => ({
      gym_id: gymId,
      room_id: roomId,
      name: r.name,
      resource_type: r.type,
      position_row: r.row,
      position_col: r.col,
      is_active: true,
    }));

    // Delete existing resources first (in case of re-onboarding)
    await supabaseAdmin
      .from("resources")
      .delete()
      .eq("gym_id", gymId);

    // Insert new resources
    const { error: resourceError } = await supabaseAdmin
      .from("resources")
      .insert(resourceRecords);

    if (resourceError) {
      console.error(`[onboarding.server] Failed to create resources for gym ${gymId}:`, resourceError);
      throw new Error(`Failed to create resources: ${resourceError.message}`);
    }

    console.log(`[onboarding.server] Gym ${gymId} created ${resourceRecords.length} resources`);
  }
}

/**
 * Save capacity settings (for capacity_only/capacity_or_none modes)
 *
 * Step 4 of onboarding (capacity_only or capacity_or_none variants).
 *
 * @param gymId - Gym UUID
 * @param data - Capacity configuration
 */
export async function saveCapacitySettings(
  gymId: string,
  data: { default_capacity: number; has_capacity_limit: boolean }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("gyms")
    .update({
      default_capacity: data.default_capacity,
      has_capacity_limit: data.has_capacity_limit,
      onboarding_step: 4, // Advance to Classes step
    })
    .eq("id", gymId);

  if (error) {
    console.error(`[onboarding.server] Failed to save capacity settings for gym ${gymId}:`, error);
    throw new Error(`Failed to save capacity: ${error.message}`);
  }

  console.log(`[onboarding.server] Gym ${gymId} capacity=${data.default_capacity}, has_limit=${data.has_capacity_limit}`);
}

/**
 * Mark onboarding as complete
 *
 * Step 7 (final step). Sets completion flags and timestamp.
 * After this, user can access /admin without redirects.
 *
 * @param gymId - Gym UUID
 */
export async function completeOnboarding(gymId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("gyms")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: 7, // Final step
    })
    .eq("id", gymId);

  if (error) {
    console.error(`[onboarding.server] Failed to complete onboarding for gym ${gymId}:`, error);
    throw new Error(`Failed to complete onboarding: ${error.message}`);
  }

  console.log(`[onboarding.server] ✅ Gym ${gymId} onboarding completed`);
}

/**
 * Check if gym has completed onboarding
 *
 * Used by requireOnboardingComplete guard in gym.server.ts
 *
 * @param gymId - Gym UUID
 * @returns true if onboarding is complete
 */
export async function hasCompletedOnboarding(gymId: string): Promise<boolean> {
  const { data: gym, error } = await supabaseAdmin
    .from("gyms")
    .select("onboarding_completed")
    .eq("id", gymId)
    .single();

  if (error || !gym) {
    console.error(`[onboarding.server] Failed to check onboarding status for gym ${gymId}:`, error);
    return false;
  }

  return gym.onboarding_completed === true;
}
