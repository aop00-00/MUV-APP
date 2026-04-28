// app/services/plan.server.ts
// Plan/package CRUD operations for the products table (type=plan).
//
// Plans are stored in the `products` table with category='plan'.
// This keeps a single products table for all purchasable items.

import { supabaseAdmin } from "./supabase.server";

export interface GymPlan {
    id: string;
    gym_id: string;
    name: string;
    description: string | null;
    price: number;
    credits: number | null; // null = unlimited
    validity_days: number;
    plan_type: "creditos" | "membresia" | "ilimitado";
    is_popular: boolean;
    is_active: boolean;
    features: string[];
    created_at: string;
}

// ── Get all plans for a gym ──────────────────────────────────────
export async function getGymPlans(gymId: string): Promise<GymPlan[]> {
    const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("gym_id", gymId)
        .eq("category", "plan")
        .order("price", { ascending: true });

    if (error) throw new Error(`Error fetching plans: ${error.message}`);

    return (data ?? []).map((p: any) => {
        const planType = p.metadata?.plan_type ?? "creditos";
        return {
            id: p.id,
            gym_id: p.gym_id,
            name: p.name,
            description: p.description,
            price: p.price,
            credits: planType === "creditos" ? p.credits : null,
            validity_days: p.metadata?.validity_days ?? 30,
            plan_type: planType,
            is_popular: p.metadata?.is_popular ?? false,
            is_active: p.is_active,
            features: p.metadata?.features ?? [],
            created_at: p.created_at,
        };
    });
}

// ── Get active plans for student view ────────────────────────────
export async function getActivePlans(gymId: string): Promise<GymPlan[]> {
    const plans = await getGymPlans(gymId);
    return plans.filter(p => p.is_active);
}

// ── Create a new plan ────────────────────────────────────────────
export async function createPlan(params: {
    gymId: string;
    name: string;
    price: number;
    credits: number | null;
    validityDays: number;
    planType: string;
    isPopular: boolean;
}): Promise<GymPlan> {
    const { gymId, name, price, credits, validityDays, planType, isPopular } = params;

    // DB column credits is NOT NULL — store 0 for unlimited plans; derive null back on read via plan_type
    const dbCredits = planType === "creditos" ? (credits ?? 0) : 0;

    const { data, error } = await supabaseAdmin
        .from("products")
        .insert({
            gym_id: gymId,
            name,
            description: `Plan ${name}`,
            price,
            category: "plan",
            credits: dbCredits,
            stock: 9999,
            is_active: true,
            metadata: {
                validity_days: validityDays,
                plan_type: planType,
                is_popular: isPopular,
                features: [],
            },
        })
        .select()
        .single();

    if (error) throw new Error(`Error creating plan: ${error.message}`);

    return {
        id: data.id,
        gym_id: data.gym_id,
        name: data.name,
        description: data.description,
        price: data.price,
        credits: planType === "creditos" ? dbCredits : null,
        validity_days: validityDays,
        plan_type: planType as GymPlan["plan_type"],
        is_popular: isPopular,
        is_active: true,
        features: [],
        created_at: data.created_at,
    };
}

// ── Toggle plan active/inactive ──────────────────────────────────
export async function togglePlan(planId: string, gymId: string, isActive: boolean): Promise<void> {
    const { error } = await supabaseAdmin
        .from("products")
        .update({ is_active: isActive })
        .eq("id", planId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error toggling plan: ${error.message}`);
}

// ── Delete a plan ────────────────────────────────────────────────
export async function deletePlan(planId: string, gymId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", planId)
        .eq("gym_id", gymId)
        .eq("category", "plan");

    if (error) throw new Error(`Error deleting plan: ${error.message}`);
}
