// app/services/gamification.server.ts
// FitCoins ledger — balance, history, and awarding.
// Reward catalog and rule logic live in fitcoin-rules.server.ts.

import { supabaseAdmin } from "./supabase.server";
import type { FitCoin, FitCoinSource } from "~/types/database";

// ── Balance ───────────────────────────────────────────────────────────────────
export async function getFitCoinBalance(userId: string, gymId: string): Promise<number> {
    if (!gymId) throw new Error("gymId is required for getFitCoinBalance");

    const { data, error } = await supabaseAdmin
        .from("fitcoins")
        .select("amount")
        .eq("user_id", userId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error fetching FitCoin balance: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

// ── History ───────────────────────────────────────────────────────────────────
export async function getFitCoinHistory(
    userId: string,
    gymId: string,
    limit = 20
): Promise<FitCoin[]> {
    if (!gymId) throw new Error("gymId is required for getFitCoinHistory");

    const { data, error } = await supabaseAdmin
        .from("fitcoins")
        .select("*")
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Error fetching FitCoin history: ${error.message}`);
    return (data ?? []) as FitCoin[];
}

// ── Award ─────────────────────────────────────────────────────────────────────
export async function awardFitCoins(
    userId: string,
    amount: number,
    source: FitCoinSource,
    description: string,
    gymId: string,
    referenceId?: string
): Promise<void> {
    if (!gymId) throw new Error("gymId is required for awardFitCoins");

    const payload: Record<string, unknown> = {
        gym_id: gymId,
        user_id: userId,
        amount,
        source,
        description,
    };
    if (referenceId) payload.reference_id = referenceId;

    const { error } = await supabaseAdmin.from("fitcoins").insert(payload);
    if (error) throw new Error(`Error awarding FitCoins: ${error.message}`);
}

// ── Backward-compat aliases ───────────────────────────────────────────────────
/** @deprecated Use getFitCoinHistory */
export const getTransactionHistory = getFitCoinHistory;

/** @deprecated Use listFitCoinRewards from fitcoin-rules.server.ts */
export async function listRewards() {
    return [];
}

/** @deprecated Use applyFitCoinRule('attendance', ...) from fitcoin-rules.server.ts */
export async function awardAttendanceFitCoins(
    userId: string,
    className: string,
    gymId: string
): Promise<void> {
    const { applyFitCoinRule } = await import("./fitcoin-rules.server");
    await applyFitCoinRule("attendance", userId, gymId, { description: `Asistencia: ${className}` });
}

/** @deprecated Use redeemFitCoinReward from fitcoin-rules.server.ts */
export async function redeemReward(
    userId: string,
    rewardId: string,
    gymId: string
): Promise<{ success: boolean; message: string }> {
    const { redeemFitCoinReward } = await import("./fitcoin-rules.server");
    return redeemFitCoinReward(userId, rewardId, gymId);
}
