// app/services/booking.server.ts
// Real Supabase booking operations using the book_class/cancel_booking/join_waitlist RPCs.

import { supabaseAdmin } from "./supabase.server";
import { redirect } from "react-router";
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

// ── Get classes for a specific date ──────────────────────────────
export async function getClassesByDate(date: string, gymId: string): Promise<ClassSlot[]> {
    if (!gymId) {
        throw new Error("gymId is required for getClassesByDate");
    }

    const start = `${date}T00:00:00Z`;
    const end = `${date}T23:59:59Z`;

    const { data, error } = await supabaseAdmin
        .from("classes")
        .select("*, coach:profiles!classes_coach_id_fkey(full_name)")
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
        const classId = formData.get("class_id") as string;
        const result = await bookClass(classId, profile.id, gymId);
        if (result.error === "class_full") {
            // Auto-join waitlist if class is full
            return joinWaitlist(classId, profile.id, gymId);
        }
        return result;
    }

    if (intent === "cancel") {
        const bookingId = formData.get("booking_id") as string;
        return cancelBooking(bookingId, profile.id, gymId);
    }

    throw redirect("/dashboard/schedule");
}
