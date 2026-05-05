// app/services/fitcoin-rules.server.ts
// Per-gym FitCoin rules engine.
// - CRUD for fitcoin_rules and fitcoin_rewards tables.
// - applyFitCoinRule(): called by automatic triggers (booking, checkout, referral).
// - grantCustomFitCoins(): called manually by admins.

import { supabaseAdmin } from "./supabase.server";
import type { FitCoinRule, FitCoinReward } from "~/types/database";
import type { FitCoinSource } from "~/types/database";
import { getFitCoinBalance, awardFitCoins } from "./gamification.server";

// ── BASE EVENT TYPES (auto-triggered) ─────────────────────────────────────────
export const BASE_EVENT_TYPES = [
    { event_type: "attendance",         label: "Asistencia a clase",   is_custom: false },
    { event_type: "purchase",           label: "Compra en tienda",     is_custom: false },
    { event_type: "referral",           label: "Referir un amigo",     is_custom: false },
    { event_type: "birthday",           label: "Cumpleaños",           is_custom: false },
    { event_type: "membership_renewal", label: "Renovación de membresía", is_custom: false },
] as const;

// ── RULES CRUD ────────────────────────────────────────────────────────────────

export async function listFitCoinRules(gymId: string): Promise<FitCoinRule[]> {
    const { data, error } = await supabaseAdmin
        .from("fitcoin_rules")
        .select("*")
        .eq("gym_id", gymId)
        .order("is_custom", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) throw new Error(`Error listing fitcoin rules: ${error.message}`);
    return (data ?? []) as FitCoinRule[];
}

export async function upsertFitCoinRule(
    gymId: string,
    rule: Omit<FitCoinRule, "id" | "gym_id" | "created_at" | "updated_at"> & { id?: string }
): Promise<FitCoinRule> {
    const payload = { ...rule, gym_id: gymId };

    const { data, error } = rule.id
        ? await supabaseAdmin
            .from("fitcoin_rules")
            .update(payload)
            .eq("id", rule.id)
            .eq("gym_id", gymId)
            .select()
            .single()
        : await supabaseAdmin
            .from("fitcoin_rules")
            .insert(payload)
            .select()
            .single();

    if (error) throw new Error(`Error upserting fitcoin rule: ${error.message}`);
    return data as FitCoinRule;
}

export async function deleteFitCoinRule(gymId: string, ruleId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("fitcoin_rules")
        .delete()
        .eq("id", ruleId)
        .eq("gym_id", gymId);
    if (error) throw new Error(`Error deleting fitcoin rule: ${error.message}`);
}

export async function toggleFitCoinRule(gymId: string, ruleId: string, isActive: boolean): Promise<void> {
    const { error } = await supabaseAdmin
        .from("fitcoin_rules")
        .update({ is_active: isActive })
        .eq("id", ruleId)
        .eq("gym_id", gymId);
    if (error) throw new Error(`Error toggling fitcoin rule: ${error.message}`);
}

// ── REWARDS CRUD ──────────────────────────────────────────────────────────────

export async function listFitCoinRewards(gymId: string, onlyActive = false): Promise<FitCoinReward[]> {
    let query = supabaseAdmin
        .from("fitcoin_rewards")
        .select("*")
        .eq("gym_id", gymId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (onlyActive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) throw new Error(`Error listing fitcoin rewards: ${error.message}`);
    return (data ?? []) as FitCoinReward[];
}

export async function upsertFitCoinReward(
    gymId: string,
    reward: { id?: string; name: string; description: string; cost: number; category: "discount" | "merch" | "access" | "experience"; is_active?: boolean; sort_order?: number }
): Promise<FitCoinReward> {
    const payload = { ...reward, gym_id: gymId };

    const { data, error } = reward.id
        ? await supabaseAdmin
            .from("fitcoin_rewards")
            .update(payload)
            .eq("id", reward.id)
            .eq("gym_id", gymId)
            .select()
            .single()
        : await supabaseAdmin
            .from("fitcoin_rewards")
            .insert(payload)
            .select()
            .single();

    if (error) throw new Error(`Error upserting fitcoin reward: ${error.message}`);
    return data as FitCoinReward;
}

export async function deleteFitCoinReward(gymId: string, rewardId: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("fitcoin_rewards")
        .delete()
        .eq("id", rewardId)
        .eq("gym_id", gymId);
    if (error) throw new Error(`Error deleting fitcoin reward: ${error.message}`);
}

// ── RULE ENGINE ───────────────────────────────────────────────────────────────

/**
 * Applies a fitcoin rule for a given event.
 * Called automatically from booking completion, checkout success, referral, etc.
 *
 * @param eventType  - e.g. 'attendance', 'purchase', 'referral'
 * @param userId     - the member receiving the points
 * @param gymId
 * @param opts.amountSpent - for 'purchase' per_amount rules (in cents or the currency unit)
 * @param opts.refereeUserId - for 'referral' rules, the new member who also gets points
 * @param opts.description - optional override for the transaction description
 * @param opts.referenceId - booking_id, order_id, etc.
 * @returns points awarded (0 if no rule found or inactive)
 */
export async function applyFitCoinRule(
    eventType: string,
    userId: string,
    gymId: string,
    opts: {
        amountSpent?: number;
        refereeUserId?: string;
        description?: string;
        referenceId?: string;
    } = {}
): Promise<number> {
    // Fetch the active rule for this gym + event
    const { data: rule, error } = await supabaseAdmin
        .from("fitcoin_rules")
        .select("*")
        .eq("gym_id", gymId)
        .eq("event_type", eventType)
        .eq("is_active", true)
        .single();

    if (error || !rule) return 0; // No rule configured — silently skip

    const source = eventTypeToSource(eventType);
    let pointsToAward = 0;

    if (rule.points_mode === "fixed") {
        pointsToAward = rule.points;
    } else if (rule.points_mode === "per_amount" && opts.amountSpent != null && rule.amount_unit) {
        pointsToAward = Math.floor(opts.amountSpent / rule.amount_unit) * rule.points;
    }

    if (pointsToAward <= 0) return 0;

    const description = opts.description ?? rule.label;

    await awardFitCoins(userId, pointsToAward, source, description, gymId, opts.referenceId);

    // For referrals: also award points to the referee (new member)
    if (eventType === "referral" && opts.refereeUserId && rule.points_referee && rule.points_referee > 0) {
        await awardFitCoins(
            opts.refereeUserId,
            rule.points_referee,
            "referral",
            "Bienvenido — puntos por ser referido",
            gymId
        );
    }

    return pointsToAward;
}

/**
 * Manually grants custom fitcoins to a member (admin action).
 * Used for custom rules (is_custom=true) or one-off admin grants.
 */
export async function grantCustomFitCoins(
    gymId: string,
    userId: string,
    points: number,
    description: string
): Promise<void> {
    await awardFitCoins(userId, points, "admin_grant", description, gymId);
}

/**
 * Redeems a reward from the gym's DB catalog (replaces hardcoded REWARD_CATALOG).
 */
export async function redeemFitCoinReward(
    userId: string,
    rewardId: string,
    gymId: string
): Promise<{ success: boolean; message: string }> {
    const { data: reward, error } = await supabaseAdmin
        .from("fitcoin_rewards")
        .select("*")
        .eq("id", rewardId)
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .single();

    if (error || !reward) return { success: false, message: "Recompensa no encontrada" };

    const balance = await getFitCoinBalance(userId, gymId);
    if (balance < reward.cost) {
        return { success: false, message: `Necesitas ${reward.cost - balance} FitCoins más` };
    }

    const { error: insertError } = await supabaseAdmin.from("fitcoins").insert({
        gym_id: gymId,
        user_id: userId,
        amount: -reward.cost,
        source: "redemption",
        description: `Canje: ${reward.name}`,
    });

    if (insertError) return { success: false, message: "Error al procesar el canje" };
    return { success: true, message: `¡${reward.name} canjeado exitosamente!` };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventTypeToSource(eventType: string): FitCoinSource {
    const map: Record<string, FitCoinSource> = {
        attendance:         "attendance",
        purchase:           "purchase",
        referral:           "referral",
        birthday:           "birthday",
        membership_renewal: "membership_renewal",
        streak_bonus:       "streak_bonus",
    };
    return map[eventType] ?? "bonus";
}
