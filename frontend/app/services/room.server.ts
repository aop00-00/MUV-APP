// app/services/room.server.ts
// Room & Class Type CRUD operations for multi-tenant gyms.

import { supabaseAdmin } from "./supabase.server";

// ─── Rooms ──────────────────────────────────────────────────────

export interface GymRoom {
    id: string;
    gym_id: string;
    name: string;
    location_id: string | null;
    location_name: string | null;
    capacity: number;
    equipment: string | null;
    is_active: boolean;
    created_at: string;
}

export async function getGymRooms(gymId: string): Promise<GymRoom[]> {
    const { data, error } = await supabaseAdmin
        .from("rooms")
        .select("*, location:locations(name), resources(id, name, resource_type, position_row, position_col, is_active)")
        .eq("gym_id", gymId)
        .order("name", { ascending: true });

    if (error) throw new Error(`Error fetching rooms: ${error.message}`);
    return (data ?? []).map((r: any) => ({
        ...r,
        location_name: r.location?.name ?? null,
        resources: (r.resources ?? []).filter((res: any) => res.is_active),
    }));
}

export interface ResourceSlot {
    row: number;
    col: number;
    name: string;
    resourceType: string;
}

export async function createRoom(params: {
    gymId: string;
    name: string;
    locationId: string | null;
    capacity: number;
    equipment: string | null;
    layoutConfig?: object | null;
    resources?: ResourceSlot[];
}): Promise<GymRoom> {
    const { data, error } = await supabaseAdmin
        .from("rooms")
        .insert({
            gym_id: params.gymId,
            name: params.name,
            location_id: params.locationId || null,
            capacity: params.capacity,
            equipment: params.equipment || null,
            is_active: true,
            layout_config: params.layoutConfig ?? null,
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating room: ${error.message}`);

    // If resource slots provided, bulk-insert into resources table
    if (params.resources && params.resources.length > 0) {
        const rows = params.resources.map(r => ({
            gym_id: params.gymId,
            room_id: data.id,
            name: r.name,
            resource_type: r.resourceType,
            position_row: r.row,
            position_col: r.col,
            is_active: true,
        }));
        const { error: resErr } = await supabaseAdmin.from("resources").insert(rows);
        if (resErr) {
            // Non-fatal: room was created, just log the error
            console.error("Error inserting resources:", resErr.message);
        }
    }

    return data as GymRoom;
}

export async function toggleRoom(roomId: string, gymId: string, isActive: boolean): Promise<void> {
    const { error } = await supabaseAdmin
        .from("rooms")
        .update({ is_active: isActive })
        .eq("id", roomId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error toggling room: ${error.message}`);
}

export async function deleteRoom(roomId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("rooms")
        .delete()
        .eq("id", roomId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting room: ${error.message}`);
}

// ─── Class Types ────────────────────────────────────────────────

export interface GymClassType {
    id: string;
    gym_id: string;
    name: string;
    color: string;
    duration: number;
    credits_required: number;
    description: string | null;
    is_active: boolean;
    created_at: string;
}

export async function getGymClassTypes(gymId: string): Promise<GymClassType[]> {
    const { data, error } = await supabaseAdmin
        .from("class_types")
        .select("*")
        .eq("gym_id", gymId)
        .order("name", { ascending: true });

    if (error) throw new Error(`Error fetching class types: ${error.message}`);
    return (data ?? []) as GymClassType[];
}

export async function createClassType(params: {
    gymId: string;
    name: string;
    color: string;
    duration: number;
    creditsRequired: number;
    description: string | null;
}): Promise<GymClassType> {
    const { data, error } = await supabaseAdmin
        .from("class_types")
        .insert({
            gym_id: params.gymId,
            name: params.name,
            color: params.color,
            duration: params.duration,
            credits_required: params.creditsRequired,
            description: params.description || null,
            is_active: true,
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating class type: ${error.message}`);
    return data as GymClassType;
}

export async function deleteClassType(classTypeId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("class_types")
        .delete()
        .eq("id", classTypeId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting class type: ${error.message}`);
}
