// app/services/gamification.server.ts
// FitCoins ledger operations using the real Supabase fitcoins table.

import { supabaseAdmin } from "./supabase.server";
import type { FitCoin, FitCoinReward } from "~/types/database";

// ── Reward catalog (stored in-process; move to DB in production) ──
export const REWARD_CATALOG: FitCoinReward[] = [
    { id: "rwd-001", name: "Clase gratis", cost: 100, description: "Canjea por 1 crédito de clase", icon: "🎯", available: true },
    { id: "rwd-002", name: "Proteína Whey", cost: 200, description: "1 scoop en cafetería", icon: "💪", available: true },
    { id: "rwd-003", name: "Camiseta Grind", cost: 500, description: "Talla a elegir en tienda", icon: "👕", available: true },
    { id: "rwd-004", name: "Mes premium gratis", cost: 800, description: "30 días del plan Elite", icon: "⭐", available: true },
    { id: "rwd-005", name: "Sesión nutricionista", cost: 300, description: "1 hora de asesoría nutricional", icon: "🥗", available: true },
    { id: "rwd-006", name: "Guantes de entreno", cost: 250, description: "Guantes oficiales Grind Project", icon: "🥊", available: true },
];

// ── Get user's FitCoin balance ────────────────────────────────────
export async function getFitCoinBalance(userId: string, gymId: string): Promise<number> {
    if (!gymId) {
        throw new Error("gymId is required for getFitCoinBalance");
    }

    const { data, error } = await supabaseAdmin
        .from("fitcoins")
        .select("amount")
        .eq("user_id", userId)
        .eq("gym_id", gymId);

    if (error) throw new Error(`Error fetching FitCoin balance: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

// ── Get transaction history ───────────────────────────────────────
export async function getFitCoinHistory(
    userId: string,
    gymId: string,
    limit = 20
): Promise<FitCoin[]> {
    if (!gymId) {
        throw new Error("gymId is required for getFitCoinHistory");
    }

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

// ── Award FitCoins ────────────────────────────────────────────────
export async function awardFitCoins(
    userId: string,
    amount: number,
    source: FitCoin["source"],
    description: string,
    gymId: string
): Promise<void> {
    if (!gymId) {
        throw new Error("gymId is required for awardFitCoins");
    }

    const currentBalance = await getFitCoinBalance(userId, gymId);
    const newBalance = currentBalance + amount;

    const { error } = await supabaseAdmin.from("fitcoins").insert({
        gym_id: gymId,
        user_id: userId,
        amount,
        source,
        description,
        balance_after: newBalance,
    });
    if (error) throw new Error(`Error awarding FitCoins: ${error.message}`);
}

// ── Redeem a reward ───────────────────────────────────────────────
export async function redeemReward(
    userId: string,
    rewardId: string,
    gymId: string
): Promise<{ success: boolean; message: string }> {
    if (!gymId) {
        throw new Error("gymId is required for redeemReward");
    }

    const reward = REWARD_CATALOG.find((r) => r.id === rewardId);
    if (!reward) return { success: false, message: "Recompensa no encontrada" };

    const balance = await getFitCoinBalance(userId, gymId);
    if (balance < reward.cost) {
        return { success: false, message: `Necesitas ${reward.cost - balance} FitCoins más` };
    }

    const newBalance = balance - reward.cost;

    const { error } = await supabaseAdmin.from("fitcoins").insert({
        gym_id: gymId,
        user_id: userId,
        amount: -reward.cost,
        source: "redemption",
        description: `Canje: ${reward.name}`,
        balance_after: newBalance,
    });

    if (error) return { success: false, message: "Error al procesar el canje" };
    return { success: true, message: `¡${reward.name} canjeado exitosamente!` };
}

// ── Award on attendance (called by webhook-payment or booking hook) ──
export async function awardAttendanceFitCoins(
    userId: string,
    className: string,
    gymId: string
): Promise<void> {
    if (!gymId) {
        throw new Error("gymId is required for awardAttendanceFitCoins");
    }
    await awardFitCoins(userId, 10, "attendance", `Asistencia: ${className}`, gymId);
}

// ── Backward-compat aliases ────────────────────────────────────────
/** @deprecated Use getFitCoinHistory */
export const getTransactionHistory = getFitCoinHistory;
/** @deprecated Use REWARD_CATALOG directly */
export const listRewards = async () => REWARD_CATALOG;
