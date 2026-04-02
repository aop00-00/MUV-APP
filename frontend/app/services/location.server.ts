// app/services/location.server.ts
// Location (sede) CRUD operations for multi-tenant gyms.

import { supabaseAdmin } from "./supabase.server";

export interface GymLocation {
    id: string;
    gym_id: string;
    name: string;
    address: string;
    city: string;
    country: string;
    phone: string | null;
    maps_url: string | null;
    is_active: boolean;
    created_at: string;
}

// ── Get all locations for a gym ─────────────────────────────────
export async function getGymLocations(gymId: string): Promise<GymLocation[]> {
    const { data, error } = await supabaseAdmin
        .from("locations")
        .select("*")
        .eq("gym_id", gymId)
        .order("name", { ascending: true });

    if (error) throw new Error(`Error fetching locations: ${error.message}`);
    return (data ?? []) as GymLocation[];
}

// ── Create a new location ───────────────────────────────────────
export async function createLocation(params: {
    gymId: string;
    name: string;
    address: string;
    city: string;
    country: string;
    phone: string | null;
    mapsUrl: string | null;
}): Promise<GymLocation> {
    const { gymId, name, address, city, country, phone, mapsUrl } = params;

    const { data, error } = await supabaseAdmin
        .from("locations")
        .insert({
            gym_id: gymId,
            name,
            address,
            city,
            country,
            phone: phone || null,
            maps_url: mapsUrl || null,
            is_active: true,
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating location: ${error.message}`);
    return data as GymLocation;
}

// ── Update a location ───────────────────────────────────────────
export async function updateLocation(
    locationId: string,
    gymId: string,
    updates: Partial<{
        name: string;
        address: string;
        city: string;
        country: string;
        phone: string | null;
        maps_url: string | null;
        is_active: boolean;
    }>
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("locations")
        .update(updates)
        .eq("id", locationId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error updating location: ${error.message}`);
}

// ── Toggle location active/inactive ─────────────────────────────
export async function toggleLocation(
    locationId: string,
    gymId: string,
    isActive: boolean
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("locations")
        .update({ is_active: isActive })
        .eq("id", locationId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error toggling location: ${error.message}`);
}

// ── Delete a location ───────────────────────────────────────────
export async function deleteLocation(locationId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("locations")
        .delete()
        .eq("id", locationId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting location: ${error.message}`);
}
