// app/services/booking.server.ts
// Real Supabase booking operations using the book_class/cancel_booking/join_waitlist RPCs.

import { supabaseAdmin } from "./supabase.server";
// Standard redirect helper to avoid "Named export not found" in Vercel's react-router bundle
const redirect = (url: string, init?: number | ResponseInit) => {
    const responseInit = typeof init === "number" ? { status: init } : init;
    return new Response(null, {
        status: responseInit?.status ?? 302,
        ...responseInit,
        headers: { Location: url, ...responseInit?.headers }
    });
};

import { requireAuth } from "./auth.server";

// ── Types ─────────────────────────────────────────────────────────
export interface ClassSlot {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    location: string | null;
    capacity: number;
    current_enrolled: number;
    coach_id: string;
    gym_id: string;
    coach?: { full_name: string };
}

export interface UserBooking {
    id: string;
    status: string;
    created_at: string;
    class: ClassSlot;
}

// ── Create a new class ───────────────────────────────────────────
export async function createClass(params: {
    gymId: string;
    title: string;
    color?: string | null;
    coach_id: string;
    start_time: string;
    end_time: string;
    capacity: number;
    location: string;
    room_id?: string;
}): Promise<ClassSlot> {
    const { gymId, title, color, coach_id, start_time, end_time, capacity, location, room_id } = params;

    // Resolve coach name so it's stored directly and never shows "Staff"
    let coach_name: string | null = null;
    if (coach_id) {
        const { data: coachRow } = await supabaseAdmin
            .from("coaches")
            .select("name")
            .eq("id", coach_id)
            .single();
        coach_name = coachRow?.name ?? null;
    }

    const { data, error } = await supabaseAdmin
        .from("classes")
        .insert({
            gym_id: gymId,
            title,
            color: color || null,
            coach_id,
            coach_name,
            start_time,
            end_time,
            capacity,
            current_enrolled: 0,
            location,
            room_id: room_id || null,
        })
        .select("*")
        .single();

    if (error) throw new Error(`Error creating class: ${error.message}`);
    return data as ClassSlot;
}

// ── Delete a class ───────────────────────────────────────────────
export async function deleteClass(classId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("classes")
        .delete()
        .eq("id", classId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error deleting class: ${error.message}`);
}

// ── Get all classes for a gym (weekly view) ─────────────────────
export async function getClassesForGym(gymId: string): Promise<ClassSlot[]> {
    if (!gymId) throw new Error("gymId is required for getClassesForGym");

    const { data, error } = await supabaseAdmin
        .from("classes")
        .select("*, coach:coaches(id, name)")
        .eq("gym_id", gymId)
        .order("start_time", { ascending: true });

    if (error) throw new Error(`Error fetching classes: ${error.message}`);

    // Normalize: if coach_name column missing but join succeeded, populate it
    return (data ?? []).map((c: any) => ({
        ...c,
        coach_name: c.coach_name || c.coach?.name || null,
    })) as ClassSlot[];
}

// ── Get classes for a specific date ──────────────────────────────
export async function getClassesByDate(date: string, gymId: string): Promise<ClassSlot[]> {
    if (!gymId) {
        throw new Error("gymId is required for getClassesByDate");
    }

    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    const { data, error } = await supabaseAdmin
        .from("classes")
        .select("*")
        .eq("gym_id", gymId)
        .gte("start_time", start)
        .lte("start_time", end)
        .order("start_time", { ascending: true });

    if (error) throw new Error(`Error fetching classes: ${error.message}`);
    return (data ?? []) as ClassSlot[];
}

// ── Get user's upcoming bookings ──────────────────────────────────
export async function getUserBookings(userId: string, gymId: string): Promise<UserBooking[]> {
    if (!gymId) {
        throw new Error("gymId is required for getUserBookings");
    }

    const { data, error } = await supabaseAdmin
        .from("bookings")
        .select("*, class:classes(*)")
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .eq("status", "confirmed")
        .gte("classes.start_time", new Date().toISOString())
        .order("created_at", { ascending: false });

    if (error) throw new Error(`Error fetching bookings: ${error.message}`);
    return (data ?? []) as UserBooking[];
}

// ── Book a class (atomic RPC) ─────────────────────────────────────
export async function bookClass(
    classId: string,
    userId: string,
    gymId: string
): Promise<{ success: boolean; booking_id?: string; credits_remaining?: number; error?: string }> {
    if (!gymId) {
        throw new Error("gymId is required for bookClass");
    }

    const { data, error } = await supabaseAdmin
        .rpc("book_class", {
            p_class_id: classId,
            p_user_id: userId,
            p_gym_id: gymId,
        });

    if (error) throw new Error(`RPC error: ${error.message}`);
    return data as { success: boolean; booking_id?: string; credits_remaining?: number; error?: string };
}

// ── Cancel a booking (atomic RPC, refund if >2h before) ──────────
export async function cancelBooking(
    bookingId: string,
    userId: string,
    gymId: string
): Promise<{ success: boolean; refunded: boolean; error?: string }> {
    if (!gymId) {
        throw new Error("gymId is required for cancelBooking");
    }

    const { data, error } = await supabaseAdmin
        .rpc("cancel_booking", {
            p_booking_id: bookingId,
            p_user_id: userId,
            p_gym_id: gymId,
        });

    if (error) throw new Error(`RPC error: ${error.message}`);
    return data as { success: boolean; refunded: boolean; error?: string };
}

// ── Join waitlist ─────────────────────────────────────────────────
export async function joinWaitlist(
    classId: string,
    userId: string,
    gymId: string
): Promise<{ success: boolean; position?: number; error?: string }> {
    if (!gymId) {
        throw new Error("gymId is required for joinWaitlist");
    }

    const { data, error } = await supabaseAdmin
        .rpc("join_waitlist", {
            p_class_id: classId,
            p_user_id: userId,
            p_gym_id: gymId,
        });

    if (error) throw new Error(`RPC error: ${error.message}`);
    return data as { success: boolean; position?: number; error?: string };
}

// ── Get waitlist position for a user+class ────────────────────────
export async function getWaitlistPosition(
    classId: string,
    userId: string,
    gymId: string
): Promise<number | null> {
    if (!gymId) {
        throw new Error("gymId is required for getWaitlistPosition");
    }

    const { data } = await supabaseAdmin
        .from("waitlist")
        .select("position")
        .eq("class_id", classId)
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .eq("status", "waiting")
        .single();

    return data?.position ?? null;
}

// ── Detect which optional columns exist on `classes` ────────────
// Lets the sync work before/after migration 011 is applied.
async function getClassesColumns(): Promise<Set<string>> {
    const { data } = await supabaseAdmin
        .from("classes")
        .select("*")
        .limit(1);
    const cols = new Set<string>();
    if (data && data.length > 0) {
        Object.keys(data[0]).forEach(k => cols.add(k));
    } else {
        // Empty table — probe by selecting specific columns
        const probe = await supabaseAdmin.from("classes").select("id, gym_id, title, start_time, end_time, capacity, location, coach_id, current_enrolled").limit(0);
        if (!probe.error) ["id","gym_id","title","start_time","end_time","capacity","location","coach_id","current_enrolled"].forEach(c => cols.add(c));
        // Probe new columns individually
        for (const c of ["schedule_id", "room_id", "coach_name", "color"]) {
            const { error } = await supabaseAdmin.from("classes").select(c).limit(0);
            if (!error) cols.add(c);
        }
    }
    return cols;
}

// ── Sync classes from schedules ─────────────────────────────────
export async function syncGymClassesFromSchedules(gymId: string, weeksAhead: number = 4, tzOffsetMinutes: number = 0) {
    if (!gymId) throw new Error("gymId is required for sync");

    // 1. Get all active schedules for this gym
    const { data: schedules, error: sError } = await supabaseAdmin
        .from("schedules")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true);

    if (sError) throw new Error(`Error fetching schedules for sync: ${sError.message}`);
    if (!schedules || schedules.length === 0) return { success: true, count: 0 };

    // Detect available optional columns once
    const cols = await getClassesColumns();
    const hasScheduleId = cols.has("schedule_id");
    const hasRoomId = cols.has("room_id");
    const hasCoachName = cols.has("coach_name");
    const hasColor = cols.has("color");

    if (!hasScheduleId) {
        throw new Error("La columna 'schedule_id' no existe en 'classes'. Ejecuta la migración 011_schedule_sync_columns.sql en Supabase antes de sincronizar horarios.");
    }

    // 2. Clear future classes linked to schedules to avoid duplicates
    const now = new Date().toISOString();
    const { error: dError } = await supabaseAdmin
        .from("classes")
        .delete()
        .eq("gym_id", gymId)
        .not("schedule_id", "is", null)
        .gte("start_time", now);

    if (dError) throw new Error(`Error clearing old synced classes: ${dError.message}`);

    // 3. Generate new class instances
    const dayMap: Record<string, number> = { "Dom": 0, "Lun": 1, "Mar": 2, "Mié": 3, "Jue": 4, "Vie": 5, "Sáb": 6 };
    const newClasses: any[] = [];

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + (weeksAhead * 7));

    for (const schedule of schedules) {
        const targetDays = (schedule.days as string[]) || [];
        const dayIndices = targetDays.map(d => dayMap[d]).filter(d => d !== undefined);

        let curr = new Date(startDate);
        while (curr <= endDate) {
            if (dayIndices.includes(curr.getDay())) {
                const [hours, minutes] = schedule.time.split(":").map(Number);
                const start = new Date(curr);
                // setHours on the server (UTC) sets UTC hours. Apply offset to convert
                // local wall-clock time → UTC: UTC = local + offsetMinutes
                start.setUTCHours(hours, minutes, 0, 0);
                start.setTime(start.getTime() + tzOffsetMinutes * 60000);

                if (start < new Date()) {
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                const end = new Date(start);
                end.setMinutes(end.getMinutes() + (schedule.duration || 60));

                const row: any = {
                    gym_id: gymId,
                    schedule_id: schedule.id,
                    title: schedule.class_name,
                    coach_id: schedule.coach_id || null,
                    capacity: schedule.capacity,
                    location: schedule.room_name,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    current_enrolled: 0,
                };
                if (hasRoomId) row.room_id = schedule.room_id || null;
                if (hasCoachName) row.coach_name = schedule.coach_name || null;
                if (hasColor) row.color = schedule.color || null;

                newClasses.push(row);
            }
            curr.setDate(curr.getDate() + 1);
        }
    }

    if (newClasses.length > 0) {
        const { error: iError } = await supabaseAdmin
            .from("classes")
            .insert(newClasses);

        if (iError) throw new Error(`Error inserting synced classes: ${iError.message}`);
    }

    return { success: true, count: newClasses.length };
}

// ── Server action helper (use in route actions) ───────────────────
export async function handleBookingAction(request: Request) {
    const profile = await requireAuth(request);
    const gymId = profile.gym_id;

    if (!gymId) {
        throw new Error("User profile has no gym_id assigned");
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "book") {
        const classId = formData.get("classId") as string;
        const result = await bookClass(classId, profile.id, gymId);
        if (result.error === "class_full") {
            // Auto-join waitlist if class is full
            return joinWaitlist(classId, profile.id, gymId);
        }
        return result;
    }

    if (intent === "cancel") {
        const bookingId = formData.get("bookingId") as string;
        return cancelBooking(bookingId, profile.id, gymId);
    }

    throw redirect("/dashboard/schedule");
}
