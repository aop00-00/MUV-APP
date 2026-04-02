// app/services/event.server.ts
// Event CRUD operations using the Supabase events table.
//
// MULTITENANT: ALL functions require an explicit gymId parameter.

import { supabaseAdmin } from "./supabase.server";

export interface GymEvent {
    id: string;
    gym_id: string;
    name: string;
    description: string;
    start_time: string;
    max_capacity: number;
    current_enrolled: number;
    price: number;
    location: string;
    is_active: boolean;
    created_at: string;
}

// ── Get all events for a gym ─────────────────────────────────────
export async function getGymEvents(gymId: string): Promise<GymEvent[]> {
    const { data, error } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("gym_id", gymId)
        .order("start_time", { ascending: true });

    if (error) throw new Error(`Error fetching events: ${error.message}`);
    return (data ?? []).map((e: any) => ({
        ...e,
        name: e.title, // Map title to name for frontend compatibility
    })) as GymEvent[];
}

// ── Get active future events (student view) ──────────────────────
export async function getActiveEvents(gymId: string): Promise<GymEvent[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
        .from("events")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .gte("start_time", now)
        .order("start_time", { ascending: true });

    if (error) throw new Error(`Error fetching active events: ${error.message}`);
    return (data ?? []).map((e: any) => ({
        ...e,
        name: e.title,
    })) as GymEvent[];
}

// ── Create a new event ───────────────────────────────────────────
export async function createEvent(params: {
    gymId: string;
    name: string;
    description: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    max_capacity: number;
    price: number;
    location: string;
}): Promise<GymEvent> {
    const { gymId, name, description, date, time, max_capacity, price, location } = params;

    const startTime = new Date(`${date}T${time}:00`).toISOString();

    const { data, error } = await supabaseAdmin
        .from("events")
        .insert({
            gym_id: gymId,
            title: name,
            description,
            start_time: startTime,
            max_capacity,
            current_enrolled: 0,
            price,
            location,
            is_active: true,
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating event: ${error.message}`);
    return {
        ...data,
        name: data.title,
    } as GymEvent;
}

// ── Delete an event ──────────────────────────────────────────────
export async function deleteEvent(eventId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting event: ${error.message}`);
}
