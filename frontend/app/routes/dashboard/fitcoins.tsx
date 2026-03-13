// app/routes/dashboard/fitcoins.tsx
// User FitCoins wallet – balance, rewards catalog, transaction history, referral code.

import type { Route } from "./+types/fitcoins";
import { useFetcher } from "react-router";
import { useState } from "react";
import {
    Zap, Gift, ArrowDownLeft, ArrowUpRight, Star,
    Copy, Check, Users, ShoppingBag, Award, Sparkles
} from "lucide-react";
// Auth and Gamification services moved to dynamic imports inside loader/action
import type { FitCoin, FitCoinReward, FitCoinSource } from "~/types/database";

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { getFitCoinBalance, getTransactionHistory, listRewards } = await import("~/services/gamification.server");
    const { profile, gymId } = await requireGymAuth(request);
    const [balance, transactions, rewards] = await Promise.all([
        getFitCoinBalance(profile.id, gymId),
        getTransactionHistory(profile.id, gymId),
        listRewards(),
    ]);

    // Referral code (deterministic from user id)
    const referralCode = `GRIND-${profile.id.slice(0, 6).toUpperCase()}`;

    return { profile, balance, transactions, rewards, referralCode };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAuth(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const rewardId = formData.get("rewardId") as string;

    if (intent === "redeem") {
        // TODO (production): call redeemFitCoins(profile.id, rewardId)
        return { success: true, message: "¡Recompensa canjeada! Revisa tu email para el código." };
    }
    return { success: false };
}

// ─── Source Config ────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    attendance: { label: "Asistencia", icon: Zap, color: "text-blue-500" },
    referral: { label: "Referido", icon: Users, color: "text-violet-500" },
    purchase: { label: "Compra", icon: ShoppingBag, color: "text-amber-500" },
    streak_bonus: { label: "Racha", icon: Star, color: "text-orange-500" },
    redemption: { label: "Canje", icon: Gift, color: "text-green-500" },
    bonus: { label: "Bonificación", icon: Sparkles, color: "text-pink-500" },
    admin_grant: { label: "Ajuste", icon: Award, color: "text-gray-500" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    discount: Zap,
    merch: ShoppingBag,
    access: Users,
    experience: Star,
};

// ─── Components ───────────────────────────────────────────────────
function TransactionRow({ tx }: { tx: FitCoin }) {
    const cfg = SOURCE_CONFIG[tx.source];
    const Icon = cfg.icon;
    const isPositive = tx.amount > 0;
    return (
        <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPositive ? "bg-green-50" : "bg-red-50"}`}>
                {isPositive
                    ? <ArrowUpRight className="w-4 h-4 text-green-600" />
                    : <ArrowDownLeft className="w-4 h-4 text-red-400" />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <div className={`flex items-center gap-1 text-[11px] font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                    </div>
                    <span className="text-[11px] text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </span>
                </div>
            </div>
            <div className="text-right flex-shrink-0">
                <span className={`text-sm font-bold ${isPositive ? "text-green-600" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}{tx.amount}
                </span>
                <p className="text-[11px] text-gray-400">{tx.balance_after} pts</p>
            </div>
        </div>
    );
}

function RewardCard({ reward, balance }: { reward: FitCoinReward; balance: number }) {
    const fetcher = useFetcher();
    const canRedeem = balance >= reward.cost;
    const Icon = CATEGORY_ICONS[reward.category ?? "discount"] ?? Zap;
    const isLoading = fetcher.state !== "idle";
    const didRedeem = fetcher.data?.success;

    return (
        <div className={`relative bg-white border rounded-2xl p-5 flex flex-col transition-all ${canRedeem ? "border-violet-200 shadow-sm hover:shadow-md" : "border-gray-100 opacity-60"}`}>
            {!canRedeem && (
                <div className="absolute inset-0 rounded-2xl bg-white/50 backdrop-blur-[1px] flex items-end justify-center pb-4">
                    <p className="text-xs text-gray-500 font-medium">
                        Necesitas {reward.cost - balance} pts más
                    </p>
                </div>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${canRedeem ? "bg-violet-100" : "bg-gray-100"}`}>
                <Icon className={`w-5 h-5 ${canRedeem ? "text-violet-600" : "text-gray-400"}`} />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">{reward.name}</h3>
            <p className="text-xs text-gray-500 mt-1 flex-1">{reward.description}</p>
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-1 text-violet-600 font-black">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-sm">{reward.cost.toLocaleString()}</span>
                    <span className="text-xs font-normal text-gray-400">pts</span>
                </div>
                <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="redeem" />
                    <input type="hidden" name="rewardId" value={reward.id} />
                    <button
                        type="submit"
                        disabled={!canRedeem || isLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-40"
                    >
                        {didRedeem ? "¡Canjeado!" : isLoading ? "Canjeando…" : "Canjear"}
                    </button>
                </fetcher.Form>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function FitCoinsPage({ loaderData }: Route.ComponentProps) {
    const { profile, balance, transactions, rewards, referralCode } = loaderData;
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"rewards" | "history">("rewards");

    const handleCopyCode = () => {
        navigator.clipboard.writeText(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Progress to next milestone
    const milestones = [500, 1000, 2000, 5000];
    const nextMilestone = milestones.find((m) => m > balance) ?? milestones[milestones.length - 1];
    const progressPct = Math.min((balance / nextMilestone) * 100, 100);

    return (
        <div className="space-y-6">
            {/* ── Hero Balance ─────────────────────────── */}
            <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden shadow-xl">
                {/* Background decorations */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-violet-200 text-sm font-medium mb-2">
                        <Zap className="w-4 h-4" />
                        Mi billetera FitCoins
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-6xl font-black">{balance.toLocaleString()}</p>
                        <p className="text-violet-300 text-xl font-medium">pts</p>
                    </div>
                    <p className="text-violet-200 text-sm mt-1">Hola, {profile.full_name.split(" ")[0]} 👋</p>

                    {/* Progress to next milestone */}
                    <div className="mt-6">
                        <div className="flex justify-between text-xs text-violet-300 mb-1.5">
                            <span>{balance.toLocaleString()} pts</span>
                            <span>Próxima recompensa: {nextMilestone.toLocaleString()} pts</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white rounded-full transition-all duration-700"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Quick Stats ──────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Ganados este mes", value: transactions.filter((t: FitCoin) => t.amount > 0 && t.created_at > new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).reduce((s: number, t: FitCoin) => s + t.amount, 0), icon: ArrowUpRight, color: "text-green-600", bg: "bg-green-50" },
                    { label: "Total canjeado", value: Math.abs(transactions.filter((t: FitCoin) => t.amount < 0).reduce((s: number, t: FitCoin) => s + t.amount, 0)), icon: Gift, color: "text-violet-600", bg: "bg-violet-50" },
                    { label: "Transacciones", value: transactions.length, icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
                ].map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-2`}>
                                <Icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                            <p className="text-2xl font-black text-gray-900">{stat.value.toLocaleString()}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Referral Card ────────────────────────── */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-amber-600" />
                            <h3 className="font-bold text-amber-900 text-sm">Invita amigos, gana FitCoins</h3>
                        </div>
                        <p className="text-xs text-amber-700 mb-3">
                            Tú ganas <strong>100 pts</strong> y tu amigo <strong>50 pts</strong> cuando se registre con tu código.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-amber-800 tracking-wider">
                                {referralCode}
                            </div>
                            <button
                                onClick={handleCopyCode}
                                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105 active:scale-95"
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? "Copiado!" : "Copiar"}
                            </button>
                        </div>
                    </div>
                    <Sparkles className="w-10 h-10 text-amber-400 flex-shrink-0 mt-1" />
                </div>
            </div>

            {/* ── Tabs: Rewards / History ──────────────── */}
            <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab("rewards")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "rewards" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <Gift className="w-4 h-4" />
                    Recompensas
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "history" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                    <Zap className="w-4 h-4" />
                    Historial
                </button>
            </div>

            {/* ── Rewards Catalog ──────────────────────── */}
            {activeTab === "rewards" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rewards.map((reward: FitCoinReward) => (
                        <RewardCard key={reward.id} reward={reward} balance={balance} />
                    ))}
                </div>
            )}

            {/* ── Transaction History ──────────────────── */}
            {activeTab === "history" && (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Historial de transacciones</h2>
                    {transactions.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <Zap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Asiste a tu primera clase para ganar FitCoins 💪</p>
                        </div>
                    ) : (
                        <div>
                            {transactions.map((tx: FitCoin) => <TransactionRow key={tx.id} tx={tx} />)}
                        </div>
                    )}
                </div>
            )}

            {/* ── How to Earn ──────────────────────────── */}
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">¿Cómo ganar FitCoins?</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: Zap, label: "Asistir a clase", value: "+10 pts", color: "bg-blue-50   text-blue-600" },
                        { icon: Users, label: "Referir un amigo", value: "+100 pts", color: "bg-violet-50 text-violet-600" },
                        { icon: ShoppingBag, label: "Comprar en tienda", value: "+5/$ pts", color: "bg-amber-50  text-amber-600" },
                        { icon: Star, label: "Racha de 7 días", value: "+50 pts", color: "bg-orange-50 text-orange-500" },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="text-center p-4 rounded-xl bg-gray-50">
                                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-2`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                                <p className="text-sm font-black text-gray-900 mt-1">{item.value}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
