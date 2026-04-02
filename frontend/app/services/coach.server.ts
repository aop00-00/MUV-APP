// app/services/coach.server.ts
// Coach CRUD operations using the Supabase coaches table.
//
// MULTITENANT: ALL functions require an explicit gymId parameter.
// Coaches are managed per-gym and may or may not have a linked auth profile.

import { supabaseAdmin } from "./supabase.server";

export interface GymCoach {
    id: string;
    gym_id: string;
    name: string;
    email: string;
    role: "titular" | "part-time" | "sustituto";
    specialty: string | null;
    specialties: string[];
    status: "activo" | "invitado" | "inactivo";
    is_active: boolean;
    rate_per_session: number;
    sessions_this_month: number;
    created_at: string;
}

// ── Get all coaches for a gym ────────────────────────────────────
export async function getGymCoaches(gymId: string): Promise<GymCoach[]> {
    const { data, error } = await supabaseAdmin
        .from("coaches")
        .select("*")
        .eq("gym_id", gymId)
        .order("name", { ascending: true });

    if (error) throw new Error(`Error fetching coaches: ${error.message}`);
    return (data ?? []) as GymCoach[];
}

// ── Create a new coach ───────────────────────────────────────────
export async function createCoach(params: {
    gymId: string;
    name: string;
    email: string;
    role: string;
    specialties: string[];
}): Promise<GymCoach> {
    const { gymId, name, email, role, specialties } = params;

    const { data, error } = await supabaseAdmin
        .from("coaches")
        .insert({
            gym_id: gymId,
            name,
            email,
            role,
            specialties,
            specialty: specialties[0] ?? null,
            status: "activo",
            is_active: true,
            rate_per_session: 200,
            sessions_this_month: 0,
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating coach: ${error.message}`);
    return data as GymCoach;
}

// ── Update a coach ───────────────────────────────────────────────
export async function updateCoach(
    coachId: string,
    gymId: string,
    updates: Partial<Pick<GymCoach, "name" | "email" | "role" | "specialties" | "status">>
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("coaches")
        .update(updates)
        .eq("id", coachId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error updating coach: ${error.message}`);
}

// ── Delete a coach ───────────────────────────────────────────────
export async function deleteCoach(coachId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("coaches")
        .delete()
        .eq("id", coachId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting coach: ${error.message}`);
}
