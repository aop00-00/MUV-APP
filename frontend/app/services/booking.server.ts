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
    coach_id: string;
    start_time: string; // ISO timestamp
    end_time: string;   // ISO timestamp
    capacity: number;
    location: string;
    room_id?: string;
}): Promise<ClassSlot> {
    const { gymId, title, coach_id, start_time, end_time, capacity, location, room_id } = params;

    const { data, error } = await supabaseAdmin
        .from("classes")
        .insert({
            gym_id: gymId,
            title,
            coach_id,
            start_time,
            end_time,
            capacity,
            current_enrolled: 0,
            location,
            room_id: room_id || null,
        })
        .select("*, coach:coaches(name)")
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
        .select("*, coach:coaches(name)")
        .eq("gym_id", gymId)
        .order("start_time", { ascending: true });

    if (error) throw new Error(`Error fetching classes: ${error.message}`);
    return (data ?? []) as ClassSlot[];
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
        .select("*, coach:coaches(name)")
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

// ── Sync classes from schedules ─────────────────────────────────
export async function syncGymClassesFromSchedules(gymId: string, weeksAhead: number = 4) {
    if (!gymId) throw new Error("gymId is required for sync");

    // 1. Get all active schedules for this gym
    const { data: schedules, error: sError } = await supabaseAdmin
        .from("schedules")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true);

    if (sError) throw new Error(`Error fetching schedules for sync: ${sError.message}`);
    if (!schedules || schedules.length === 0) return { success: true, count: 0 };

    // 2. Clear future classes linked to schedules to avoid duplicates
    // We only clear from 'now' onwards
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

        // Iterate through each day in the range
        let curr = new Date(startDate);
        while (curr <= endDate) {
            if (dayIndices.includes(curr.getDay())) {
                // Combine date with schedule time
                const [hours, minutes] = schedule.time.split(":").map(Number);
                const start = new Date(curr);
                start.setHours(hours, minutes, 0, 0);

                // Skip if start time is in the past
                if (start < new Date()) {
                    curr.setDate(curr.getDate() + 1);
                    continue;
                }

                const end = new Date(start);
                end.setMinutes(end.getMinutes() + (schedule.duration || 60));

                newClasses.push({
                    gym_id: gymId,
                    schedule_id: schedule.id,
                    title: schedule.class_name,
                    coach_id: schedule.coach_id, // Use ID if available
                    capacity: schedule.capacity,
                    location: schedule.room_name,
                    room_id: schedule.room_id || null,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    current_enrolled: 0
                });
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
