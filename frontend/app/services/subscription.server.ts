// app/services/subscription.server.ts
// Membership / subscription operations using the real Supabase memberships table.
//
// MULTITENANT: ALL functions require an explicit gymId parameter.
// Never use a fallback default — gymId must come from the authenticated session.
// Use getGymIdFromClaims() or getGymIdFromProfile() from supabase.server.ts.

import { supabaseAdmin } from "./supabase.server";
import type { Subscription } from "~/types/database";

// ── Plan catalog (move to gyms.features or a plans table in production) ──
export const PLAN_CATALOG = [
    { id: "plan-starter",   name: "Starter",   price: 499,  credits: 8,  billing: "monthly", color: "blue" },
    { id: "plan-pro",       name: "Pro",        price: 799,  credits: 12, billing: "monthly", color: "violet" },
    { id: "plan-elite",     name: "Elite",      price: 1299, credits: 20, billing: "monthly", color: "amber" },
    { id: "plan-unlimited", name: "Ilimitado",  price: 1899, credits: 99, billing: "monthly", color: "emerald" },
] as const;

// ── Get all memberships for admin ─────────────────────────────────
export async function getAllMemberships(gymId: string): Promise<Subscription[]> {
    const { data, error } = await supabaseAdmin
        .from("memberships")
        .select("*, user:profiles(full_name, email, phone, avatar_url)")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(`Error fetching memberships: ${error.message}`);
    return (data ?? []) as unknown as Subscription[];
}

// ── Get active membership for a user ──────────────────────────────
export async function getUserMembership(
    userId: string,
    gymId: string
): Promise<Subscription | null> {
    const { data, error } = await supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error?.code === "PGRST116") return null; // no rows
    if (error) throw new Error(`Error fetching membership: ${error.message}`);
    return data as Subscription;
}

// ── Freeze a membership ────────────────────────────────────────────
export async function freezeMembership(
    membershipId: string,
    gymId: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("memberships")
        .update({ status: "frozen" })
        .eq("id", membershipId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error freezing membership: ${error.message}`);
}

// ── Reactivate a frozen membership ────────────────────────────────
export async function reactivateMembership(
    membershipId: string,
    gymId: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("memberships")
        .update({ status: "active" })
        .eq("id", membershipId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error reactivating membership: ${error.message}`);
}

// ── Cancel a membership ────────────────────────────────────────────
export async function cancelMembership(
    membershipId: string,
    gymId: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from("memberships")
        .update({ status: "cancelled" })
        .eq("id", membershipId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error cancelling membership: ${error.message}`);
}

// ── Get memberships expiring in the next N days (renewal queue) ───
export async function getExpiringMemberships(
    days: number,
    gymId: string
): Promise<Subscription[]> {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

    const { data, error } = await supabaseAdmin
        .from("memberships")
        .select("*, user:profiles(full_name, email, phone)")
        .eq("gym_id", gymId)
        .eq("status", "active")
        .lte("end_date", cutoff)
        .order("end_date", { ascending: true });

    if (error) throw new Error(`Error fetching expiring memberships: ${error.message}`);
    return (data ?? []) as unknown as Subscription[];
}

// ── Create a new membership (Link customer to plan) ────────────────
export async function createMembership({
    userId,
    gymId,
    planName,
    price,
    credits,
    validityDays,
    months,
}: {
    userId: string;
    gymId: string;
    planName: string;
    price: number;
    credits: number;
    validityDays?: number;
    months?: number;
}): Promise<Subscription> {
    const startDate = new Date();
    const endDate = new Date();
    if (validityDays) {
        endDate.setDate(endDate.getDate() + validityDays);
    } else {
        endDate.setMonth(endDate.getMonth() + (months ?? 1));
    }

    const { data, error } = await supabaseAdmin
        .from("memberships")
        .insert({
            user_id: userId,
            gym_id: gymId,
            plan_name: planName,
            status: "active",
            price: price,
            credits_included: credits,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating membership: ${error.message}`);
    return data as Subscription;
}

// ── Stats for admin dashboard ─────────────────────────────────────
export async function getMembershipStats(gymId: string) {
    const { data: memberships, error } = await supabaseAdmin
        .from("memberships")
        .select("status, price")
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error fetching stats: ${error.message}`);

    const rows = memberships ?? [];
    return {
        active:  rows.filter((m) => m.status === "active").length,
        frozen:  rows.filter((m) => m.status === "frozen").length,
        expired: rows.filter((m) => m.status === "expired").length,
        mrr:     rows.filter((m) => m.status === "active").reduce((s, m) => s + Number(m.price), 0),
    };
}

// ── Backward-compat aliases ────────────────────────────────────────
/** @deprecated Use getAllMemberships */
export const listSubscriptions = getAllMemberships;
/** @deprecated Use getExpiringMemberships */
export const getRenewalQueue = getExpiringMemberships;
/** @deprecated Use PLAN_CATALOG directly */
export const listPlans = async () => [...PLAN_CATALOG];
