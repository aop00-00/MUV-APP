// app/routes/admin/fitcoins.tsx
// Admin panel: configure per-gym FitCoin rules, rewards catalog, and grant manual points.

import type { Route } from "./+types/fitcoins";
import { useFetcher, useLoaderData } from "react-router";
import { useState } from "react";
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Gift, Users, Award } from "lucide-react";
import type { FitCoinRule, FitCoinReward } from "~/types/database";

// ── BASE EVENT TYPES shown in the UI ─────────────────────────────────────────
const BASE_EVENTS = [
    { event_type: "attendance",         label: "Asistencia a clase" },
    { event_type: "purchase",           label: "Compra en tienda" },
    { event_type: "referral",           label: "Referir un amigo" },
    { event_type: "birthday",           label: "Cumpleaños" },
    { event_type: "membership_renewal", label: "Renovación de membresía" },
];

// ── Loader ────────────────────────────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { listFitCoinRules, listFitCoinRewards } = await import("~/services/fitcoin-rules.server");
    const { gymId } = await requireGymAdmin(request);

    const [rules, rewards] = await Promise.all([
        listFitCoinRules(gymId),
        listFitCoinRewards(gymId),
    ]);

    return { rules, rewards, gymId };
}

// ── Action ────────────────────────────────────────────────────────────────────
export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const {
        upsertFitCoinRule, deleteFitCoinRule, toggleFitCoinRule,
        upsertFitCoinReward, deleteFitCoinReward, grantCustomFitCoins,
    } = await import("~/services/fitcoin-rules.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");

    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    // ── Rules ──────────────────────────────────────────────────────
    if (intent === "upsert_rule") {
        const pointsMode = formData.get("points_mode") as string;
        const ruleId = formData.get("id") as string | null;
        await upsertFitCoinRule(gymId, {
            ...(ruleId ? { id: ruleId } : {}),
            event_type:    formData.get("event_type") as string,
            label:         formData.get("label") as string,
            is_custom:     formData.get("is_custom") === "true",
            is_active:     true,
            points_mode:   pointsMode as "fixed" | "per_amount",
            points:        Number(formData.get("points")),
            amount_unit:   pointsMode === "per_amount" ? Number(formData.get("amount_unit")) : null,
            points_referee: formData.get("points_referee") ? Number(formData.get("points_referee")) : null,
        });
        return { success: true };
    }

    if (intent === "toggle_rule") {
        await toggleFitCoinRule(gymId, formData.get("id") as string, formData.get("is_active") === "true");
        return { success: true };
    }

    if (intent === "delete_rule") {
        await deleteFitCoinRule(gymId, formData.get("id") as string);
        return { success: true };
    }

    // ── Rewards ────────────────────────────────────────────────────
    if (intent === "upsert_reward") {
        const rewardId = formData.get("id") as string | null;
        await upsertFitCoinReward(gymId, {
            ...(rewardId ? { id: rewardId } : {}),
            name:        formData.get("name") as string,
            description: formData.get("description") as string,
            cost:        Number(formData.get("cost")),
            category:    (formData.get("category") as string || "experience") as "discount" | "merch" | "access" | "experience",
            is_active:   true,
            sort_order:  Number(formData.get("sort_order") ?? 0),
        });
        return { success: true };
    }

    if (intent === "delete_reward") {
        await deleteFitCoinReward(gymId, formData.get("id") as string);
        return { success: true };
    }

    // ── Manual grant ───────────────────────────────────────────────
    if (intent === "grant") {
        const email = formData.get("email") as string;
        const points = Number(formData.get("points"));
        const description = formData.get("description") as string;

        if (!email || !points || !description) {
            return { error: "Completa todos los campos del otorgamiento manual." };
        }

        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("email", email)
            .eq("gym_id", gymId)
            .single();

        if (!profile) return { error: `No se encontró al usuario: ${email}` };

        await grantCustomFitCoins(gymId, profile.id, points, description);
        return { success: true, message: `+${points} FitCoins otorgados a ${email}` };
    }

    return { error: "Acción no reconocida" };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminFitcoins() {
    const { rules, rewards } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const [tab, setTab] = useState<"rules" | "rewards" | "grant">("rules");
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [showRewardForm, setShowRewardForm] = useState(false);
    const [editRule, setEditRule] = useState<FitCoinRule | null>(null);
    const [editReward, setEditReward] = useState<FitCoinReward | null>(null);
    const [customMode, setCustomMode] = useState(false);
    const [pointsMode, setPointsMode] = useState<"fixed" | "per_amount">("fixed");

    const isLoading = fetcher.state !== "idle";
    const result = fetcher.data as any;

    function openRuleForm(rule?: FitCoinRule, isCustom = false) {
        setEditRule(rule ?? null);
        setCustomMode(isCustom);
        setPointsMode(rule?.points_mode ?? "fixed");
        setShowRuleForm(true);
    }

    function openRewardForm(reward?: FitCoinReward) {
        setEditReward(reward ?? null);
        setShowRewardForm(true);
    }

    // Separate base rules from custom rules
    const baseRules = rules.filter(r => !r.is_custom);
    const customRules = rules.filter(r => r.is_custom);

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-6 h-6 text-violet-400" />
                        FitCoins
                    </h1>
                    <p className="text-white/50 text-sm mt-1">Configura cómo ganan y canjean puntos tus miembros.</p>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex bg-white/5 p-1 rounded-xl w-fit gap-1">
                {(["rules", "rewards", "grant"] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? "bg-violet-600 text-white shadow" : "text-white/60 hover:text-white"}`}
                    >
                        {t === "rules" ? "Reglas de puntos" : t === "rewards" ? "Recompensas" : "Otorgar manual"}
                    </button>
                ))}
            </div>

            {/* ─────────────────── RULES TAB ─────────────────── */}
            {tab === "rules" && (
                <div className="space-y-6">
                    {/* Base events */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h2 className="text-white font-bold mb-1">Eventos automáticos</h2>
                        <p className="text-white/40 text-xs mb-4">Se disparan solos cuando ocurre el evento en el sistema.</p>
                        <div className="space-y-3">
                            {BASE_EVENTS.map(ev => {
                                const rule = baseRules.find(r => r.event_type === ev.event_type);
                                return (
                                    <div key={ev.event_type} className="flex items-center justify-between gap-4 bg-white/5 rounded-xl px-4 py-3">
                                        <div className="flex-1">
                                            <p className="text-white text-sm font-medium">{ev.label}</p>
                                            {rule ? (
                                                <p className="text-white/40 text-xs mt-0.5">
                                                    {rule.points_mode === "fixed"
                                                        ? `${rule.points} pts por evento`
                                                        : `${rule.points} pt por cada $${rule.amount_unit}`}
                                                    {ev.event_type === "referral" && rule.points_referee
                                                        ? ` · Referido recibe ${rule.points_referee} pts`
                                                        : ""}
                                                </p>
                                            ) : (
                                                <p className="text-white/30 text-xs mt-0.5">Sin configurar</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {rule && (
                                                <fetcher.Form method="post">
                                                    <input type="hidden" name="intent" value="toggle_rule" />
                                                    <input type="hidden" name="id" value={rule.id} />
                                                    <input type="hidden" name="is_active" value={String(!rule.is_active)} />
                                                    <button type="submit" title={rule.is_active ? "Desactivar" : "Activar"}>
                                                        {rule.is_active
                                                            ? <ToggleRight className="w-5 h-5 text-violet-400" />
                                                            : <ToggleLeft className="w-5 h-5 text-white/30" />}
                                                    </button>
                                                </fetcher.Form>
                                            )}
                                            <button
                                                onClick={() => openRuleForm(rule, false)}
                                                className="text-xs px-3 py-1 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded-lg transition-all"
                                            >
                                                {rule ? "Editar" : "Configurar"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom rules */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-white font-bold">Acciones extra (manuales)</h2>
                                <p className="text-white/40 text-xs mt-0.5">El admin otorga estos puntos manualmente desde la pestaña "Otorgar manual".</p>
                            </div>
                            <button
                                onClick={() => openRuleForm(undefined, true)}
                                className="flex items-center gap-1.5 text-xs px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" /> Agregar acción
                            </button>
                        </div>
                        {customRules.length === 0 ? (
                            <p className="text-white/30 text-sm text-center py-6">Sin acciones extra configuradas.</p>
                        ) : (
                            <div className="space-y-3">
                                {customRules.map(rule => (
                                    <div key={rule.id} className="flex items-center justify-between gap-4 bg-white/5 rounded-xl px-4 py-3">
                                        <div className="flex-1">
                                            <p className="text-white text-sm font-medium">{rule.label}</p>
                                            <p className="text-white/40 text-xs mt-0.5">{rule.points} pts</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <fetcher.Form method="post">
                                                <input type="hidden" name="intent" value="toggle_rule" />
                                                <input type="hidden" name="id" value={rule.id} />
                                                <input type="hidden" name="is_active" value={String(!rule.is_active)} />
                                                <button type="submit">
                                                    {rule.is_active
                                                        ? <ToggleRight className="w-5 h-5 text-violet-400" />
                                                        : <ToggleLeft className="w-5 h-5 text-white/30" />}
                                                </button>
                                            </fetcher.Form>
                                            <button
                                                onClick={() => openRuleForm(rule, true)}
                                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg transition-all"
                                            >
                                                Editar
                                            </button>
                                            <fetcher.Form method="post">
                                                <input type="hidden" name="intent" value="delete_rule" />
                                                <input type="hidden" name="id" value={rule.id} />
                                                <button type="submit" className="text-red-400 hover:text-red-300 p-1">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </fetcher.Form>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Rule form modal */}
                    {showRuleForm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                                <h3 className="text-white font-bold mb-4">
                                    {editRule ? "Editar regla" : customMode ? "Nueva acción extra" : "Configurar evento"}
                                </h3>
                                <fetcher.Form method="post" onSubmit={() => setShowRuleForm(false)} className="space-y-4">
                                    <input type="hidden" name="intent" value="upsert_rule" />
                                    {editRule && <input type="hidden" name="id" value={editRule.id} />}
                                    <input type="hidden" name="is_custom" value={String(customMode)} />

                                    {customMode ? (
                                        <>
                                            <div>
                                                <label className="text-white/60 text-xs mb-1 block">Nombre de la acción *</label>
                                                <input name="label" required defaultValue={editRule?.label}
                                                    placeholder="Ej: Trajo a un amigo, Participó en torneo..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                                <input type="hidden" name="event_type" value={editRule?.event_type || `custom_${Date.now()}`} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="text-white/60 text-xs mb-1 block">Evento</label>
                                                <select name="event_type" defaultValue={editRule?.event_type}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                                                    {BASE_EVENTS.map(e => (
                                                        <option key={e.event_type} value={e.event_type} className="bg-gray-900">{e.label}</option>
                                                    ))}
                                                </select>
                                                <input type="hidden" name="label" value={editRule?.label ?? BASE_EVENTS[0].label} />
                                            </div>
                                        </>
                                    )}

                                    {!customMode && (
                                        <div>
                                            <label className="text-white/60 text-xs mb-1 block">Modo de puntos</label>
                                            <select name="points_mode" value={pointsMode} onChange={e => setPointsMode(e.target.value as any)}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                                                <option value="fixed" className="bg-gray-900">Fijo — X pts por evento</option>
                                                <option value="per_amount" className="bg-gray-900">Proporcional — X pts por cada $Y</option>
                                            </select>
                                        </div>
                                    )}
                                    {customMode && <input type="hidden" name="points_mode" value="fixed" />}

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-white/60 text-xs mb-1 block">
                                                {pointsMode === "per_amount" ? "Pts por unidad" : "Puntos *"}
                                            </label>
                                            <input name="points" type="number" min="1" required defaultValue={editRule?.points ?? ""}
                                                placeholder="Ej: 10"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                        </div>
                                        {pointsMode === "per_amount" && (
                                            <div>
                                                <label className="text-white/60 text-xs mb-1 block">Cada $</label>
                                                <input name="amount_unit" type="number" min="1" defaultValue={editRule?.amount_unit ?? 100}
                                                    placeholder="100"
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                            </div>
                                        )}
                                    </div>

                                    {!customMode && (
                                        <div>
                                            <label className="text-white/60 text-xs mb-1 block">Pts para el referido (solo para Referido)</label>
                                            <input name="points_referee" type="number" min="0" defaultValue={editRule?.points_referee ?? ""}
                                                placeholder="Ej: 50 (dejar vacío si no aplica)"
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowRuleForm(false)}
                                            className="flex-1 py-2 border border-white/10 text-white/60 rounded-lg text-sm hover:bg-white/5">
                                            Cancelar
                                        </button>
                                        <button type="submit" disabled={isLoading}
                                            className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                            {isLoading ? "Guardando…" : "Guardar"}
                                        </button>
                                    </div>
                                </fetcher.Form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─────────────────── REWARDS TAB ─────────────────── */}
            {tab === "rewards" && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={() => openRewardForm()}
                            className="flex items-center gap-1.5 text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all">
                            <Plus className="w-4 h-4" /> Nueva recompensa
                        </button>
                    </div>

                    {rewards.length === 0 ? (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                            <Gift className="w-10 h-10 text-white/20 mx-auto mb-3" />
                            <p className="text-white/40 text-sm">Sin recompensas configuradas. Agrega la primera para que tus miembros puedan canjear puntos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {rewards.map(r => (
                                <div key={r.id} className={`bg-white/5 border rounded-2xl p-5 flex flex-col gap-3 ${r.is_active ? "border-white/10" : "border-white/5 opacity-50"}`}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-white font-bold">{r.name}</p>
                                            <p className="text-white/50 text-xs mt-0.5">{r.description}</p>
                                        </div>
                                        <span className="text-violet-400 font-black text-lg">{r.cost.toLocaleString()} pts</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs px-2 py-0.5 bg-white/10 text-white/60 rounded-full">{r.category}</span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openRewardForm(r)}
                                                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg">
                                                Editar
                                            </button>
                                            <fetcher.Form method="post">
                                                <input type="hidden" name="intent" value="delete_reward" />
                                                <input type="hidden" name="id" value={r.id} />
                                                <button type="submit" className="text-red-400 hover:text-red-300 p-1">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </fetcher.Form>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Reward form modal */}
                    {showRewardForm && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                                <h3 className="text-white font-bold mb-4">{editReward ? "Editar recompensa" : "Nueva recompensa"}</h3>
                                <fetcher.Form method="post" onSubmit={() => setShowRewardForm(false)} className="space-y-4">
                                    <input type="hidden" name="intent" value="upsert_reward" />
                                    {editReward && <input type="hidden" name="id" value={editReward.id} />}

                                    <div>
                                        <label className="text-white/60 text-xs mb-1 block">Nombre *</label>
                                        <input name="name" required defaultValue={editReward?.name}
                                            placeholder="Ej: Clase gratis, Camiseta..."
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                    </div>
                                    <div>
                                        <label className="text-white/60 text-xs mb-1 block">Descripción</label>
                                        <input name="description" defaultValue={editReward?.description}
                                            placeholder="Breve descripción para el miembro"
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-white/60 text-xs mb-1 block">Costo en pts *</label>
                                            <input name="cost" type="number" min="1" required defaultValue={editReward?.cost}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
                                        </div>
                                        <div>
                                            <label className="text-white/60 text-xs mb-1 block">Categoría</label>
                                            <select name="category" defaultValue={editReward?.category ?? "experience"}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                                                <option value="experience" className="bg-gray-900">Experiencia</option>
                                                <option value="discount" className="bg-gray-900">Descuento</option>
                                                <option value="merch" className="bg-gray-900">Merch</option>
                                                <option value="access" className="bg-gray-900">Acceso</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-white/60 text-xs mb-1 block">Orden (menor = primero)</label>
                                        <input name="sort_order" type="number" min="0" defaultValue={editReward?.sort_order ?? 0}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={() => setShowRewardForm(false)}
                                            className="flex-1 py-2 border border-white/10 text-white/60 rounded-lg text-sm hover:bg-white/5">
                                            Cancelar
                                        </button>
                                        <button type="submit" disabled={isLoading}
                                            className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                            {isLoading ? "Guardando…" : "Guardar"}
                                        </button>
                                    </div>
                                </fetcher.Form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─────────────────── GRANT TAB ─────────────────── */}
            {tab === "grant" && (
                <div className="space-y-6">
                    {/* Manual grant form */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Award className="w-5 h-5 text-amber-400" />
                            <h2 className="text-white font-bold">Otorgar puntos manualmente</h2>
                        </div>
                        <fetcher.Form method="post" className="space-y-4">
                            <input type="hidden" name="intent" value="grant" />
                            <div>
                                <label className="text-white/60 text-xs mb-1 block">Email del miembro *</label>
                                <input name="email" type="email" required
                                    placeholder="miembro@email.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                            </div>

                            {/* Quick-select from custom rules */}
                            {customRules.filter(r => r.is_active).length > 0 && (
                                <div>
                                    <label className="text-white/60 text-xs mb-2 block">Acciones rápidas</label>
                                    <div className="flex flex-wrap gap-2">
                                        {customRules.filter(r => r.is_active).map(rule => (
                                            <button key={rule.id} type="button"
                                                onClick={(e) => {
                                                    const form = (e.target as HTMLElement).closest("form")!;
                                                    (form.querySelector('[name="points"]') as HTMLInputElement).value = String(rule.points);
                                                    (form.querySelector('[name="description"]') as HTMLInputElement).value = rule.label;
                                                }}
                                                className="text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded-lg transition-all">
                                                {rule.label} (+{rule.points} pts)
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-white/60 text-xs mb-1 block">Puntos *</label>
                                    <input name="points" type="number" min="1" required
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
                                </div>
                                <div>
                                    <label className="text-white/60 text-xs mb-1 block">Descripción *</label>
                                    <input name="description" required
                                        placeholder="Motivo del otorgamiento"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500" />
                                </div>
                            </div>

                            {result?.error && (
                                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{result.error}</p>
                            )}
                            {result?.message && (
                                <p className="text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{result.message}</p>
                            )}

                            <button type="submit" disabled={isLoading}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-all">
                                {isLoading ? "Otorgando…" : "Otorgar FitCoins"}
                            </button>
                        </fetcher.Form>
                    </div>

                    {/* Info box */}
                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex gap-3">
                        <Users className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-violet-300 text-sm font-medium">Acciones extra configuradas</p>
                            <p className="text-violet-400/70 text-xs mt-1">
                                Tienes {customRules.filter(r => r.is_active).length} acción(es) activa(s) disponibles como acceso rápido.
                                Agrégalas desde la pestaña "Reglas de puntos".
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
