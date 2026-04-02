// app/routes/admin/users.tsx
// Admin – CRM User Management with segmentation, attendance semaphore, and tags (MOCK DATA).
// Auth and Server services moved to dynamic imports inside loader/action
import type { Route } from "./+types/users";
import { useFetcher, useRevalidator } from "react-router";
import { useState, useEffect, useRef } from "react";
import { Search, PhoneForwarded, Tag, X, UserPlus, Mail, FileText, MoreVertical, Check } from "lucide-react";
import { toast } from "react-hot-toast";

// ─── Mock Data ───────────────────────────────────────────────────
// Server services moved to dynamic imports

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { getGymPlans } = await import("~/services/plan.server");

    const { profile, gymId } = await requireGymAdmin(request);

    // Fetch real users (profiles) for this gym
    const { data: users, error } = await supabaseAdmin
        .from("profiles")
        .select(`
            id,
            full_name,
            email,
            credits,
            phone,
            role,
            created_at,
            gym_id,
            metadata,
            memberships (
                plan_name,
                end_date,
                status
            )
        `)
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching users:", error);
        return { users: [], plans: [] };
    }

    // Fetch gym's real plans from products table
    const gymPlans = await getGymPlans(gymId);

    // Map DB data to CRMUser interface
    const mappedUsers = (users || []).map(u => {
        const membership = u.memberships && Array.isArray(u.memberships) ? u.memberships[0] : null;
        const lastVisitDaysAgo = 0; // Mocked for now until attendance is real

        let segment: any = "new";
        if (u.credits > 10) segment = "vip";
        else if (membership?.status === "active") segment = "active";

        // Extract tags from metadata
        const metadata = u.metadata || {};
        const tags = Array.isArray(metadata.tags) ? metadata.tags : [];

        return {
            id: u.id,
            full_name: u.full_name || "Sin nombre",
            email: u.email,
            phone: u.phone || "",
            credits: u.credits || 0,
            joinDate: u.created_at,
            lastVisitDaysAgo,
            segment,
            membership: membership ? {
                plan_name: membership.plan_name,
                end_date: membership.end_date,
                status: membership.status
            } : null,
            tags,
            totalSpent: 0
        };
    });

    return {
        users: mappedUsers,
        plans: gymPlans.filter(p => p.is_active),
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { createMembership } = await import("~/services/subscription.server");
    const { getGymPlans } = await import("~/services/plan.server");

    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create_user") {
        const email = formData.get("email") as string;
        const full_name = formData.get("full_name") as string;
        const password = formData.get("password") as string || "Grind2026!";
        const planId = formData.get("planId") as string;

        // Enforce per-plan member limits
        // DB trigger is the hard stop, this is the UX layer
        const { PLAN_FEATURES } = await import("~/config/plan-features");
        const { data: gymData } = await supabaseAdmin.from("gyms").select("plan_id").eq("id", gymId).single();
        const gymPlanDef = PLAN_FEATURES[(gymData?.plan_id || "starter") as keyof typeof PLAN_FEATURES];
        const maxMembers = gymPlanDef?.maxMembers;
        
        if (maxMembers != null) {
            const { count } = await supabaseAdmin
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("gym_id", gymId)
                .eq("role", "member");
            if ((count ?? 0) >= maxMembers) {
                const upgradeTarget = gymData?.plan_id === "emprendedor" ? "Starter" : "Pro";
                return {
                    error: `Tu studio alcanzó el límite de ${maxMembers} alumnos del plan ${gymPlanDef?.label}. Actualiza a ${upgradeTarget} para seguir creciendo.`,
                    limitReached: "members",
                };
            }
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name,
                gym_id: gymId,
                role: "member"
            }
        });

        if (error) {
            console.error("Error creating user:", error);
            return { error: error.message };
        }

        // Create profile manually (trigger is disabled in Supabase)
        const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .upsert({
                id: data.user.id,
                email,
                full_name,
                role: "member",
                credits: 0,
                gym_id: gymId,
            }, { onConflict: "id" });

        if (profileError) {
            console.error("Error creating profile:", profileError);
            await supabaseAdmin.auth.admin.deleteUser(data.user.id);
            return { error: `Error al crear perfil: ${profileError.message}` };
        }

        // Integrated Plan Assignment — uses gym's real plans from products table
        if (planId && planId !== "none") {
            const gymPlans = await getGymPlans(gymId);
            const plan = gymPlans.find(p => p.id === planId);
            if (plan) {
                try {
                    const creditsToAssign = plan.credits ?? 999; // null = ilimitado

                    await createMembership({
                        userId: data.user.id,
                        gymId: gymId,
                        planName: plan.name,
                        price: plan.price,
                        credits: creditsToAssign,
                        validityDays: plan.validity_days,
                    });

                    // Sum credits to profile
                    await supabaseAdmin
                        .from("profiles")
                        .update({ credits: creditsToAssign })
                        .eq("id", data.user.id)
                        .eq("gym_id", gymId);
                } catch (subError: any) {
                    return {
                        success: true,
                        message: `Usuario creado, pero hubo un error al vincular el plan: ${subError.message}`
                    };
                }
            }
        }

        return { success: true, message: "Usuario creado y vinculado exitosamente." };
    }

    if (intent === "update_credits") {
        const userId = formData.get("userId") as string;
        const credits = parseInt(formData.get("credits") as string, 10);

        const { error } = await supabaseAdmin
            .from("profiles")
            .update({ credits })
            .eq("id", userId)
            .eq("gym_id", gymId);

        if (error) return { error: error.message };
        return { success: true };
    }

    if (intent === "add_tag") {
        const userId = formData.get("userId") as string;
        const tag = formData.get("tag") as string;

        // Fetch current profile to get existing tags
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("metadata")
            .eq("id", userId)
            .eq("gym_id", gymId)
            .single();

        const currentMetadata = profile?.metadata || {};
        const currentTags = Array.isArray(currentMetadata.tags) ? currentMetadata.tags : [];

        if (!currentTags.includes(tag)) {
            const newTags = [...currentTags, tag];
            const { error } = await supabaseAdmin
                .from("profiles")
                .update({ metadata: { ...currentMetadata, tags: newTags } })
                .eq("id", userId)
                .eq("gym_id", gymId);

            if (error) return { error: error.message };
        }

        return { success: true };
    }

    if (intent === "remove_tag") {
        const userId = formData.get("userId") as string;
        const tag = formData.get("tag") as string;

        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("metadata")
            .eq("id", userId)
            .eq("gym_id", gymId)
            .single();

        const currentMetadata = profile?.metadata || {};
        const currentTags = Array.isArray(currentMetadata.tags) ? currentMetadata.tags : [];
        const newTags = currentTags.filter((t: string) => t !== tag);

        const { error } = await supabaseAdmin
            .from("profiles")
            .update({ metadata: { ...currentMetadata, tags: newTags } })
            .eq("id", userId)
            .eq("gym_id", gymId);

        if (error) return { error: error.message };
        return { success: true };
    }

    return { success: true };
}

function AttendanceSemaphore({ daysAgo }: { daysAgo: number }) {
    if (daysAgo <= 2) {
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-xs text-green-700 font-medium">{daysAgo === 0 ? "Hoy" : `Hace ${daysAgo}d`}</span>
            </div>
        );
    }
    if (daysAgo <= 7) {
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-xs text-yellow-700 font-medium">Hace {daysAgo}d</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-red-600 font-medium">Hace {daysAgo}d</span>
        </div>
    );
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
    const { users, plans } = loaderData;
    const fetcher = useFetcher();
    const creditFetcher = useFetcher();
    const tagFetcher = useFetcher();
    const revalidator = useRevalidator();
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCredits, setEditingCredits] = useState<{ userId: string; value: number } | null>(null);
    const [addingTagFor, setAddingTagFor] = useState<string | null>(null);
    const [newTagText, setNewTagText] = useState("");
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
    const lastCreditSubmissionId = useRef<string | null>(null);
    const lastTagSubmissionId = useRef<string | null>(null);


    // Close modal on success
    useEffect(() => {
        if (fetcher.data?.success && fetcher.state === "idle") {
            const timer = setTimeout(() => setShowAddModal(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [fetcher.data, fetcher.state]);

    // Show toast notification when credits are updated and revalidate data
    useEffect(() => {
        if (creditFetcher.state === "submitting") {
            // Track submitting state but doesn't trigger toast
        } else if (creditFetcher.state === "idle" && creditFetcher.data?.success) {
            // Only show toast if we haven't processed this submission yet
            // Use a combination of timestamp or a unique marker if available, 
            // but since it's a fetcher, we check if it's a "fresh" success
            if (lastCreditSubmissionId.current !== JSON.stringify(creditFetcher.data)) {
                toast.success("Créditos actualizados correctamente", {
                    duration: 2000,
                    position: "bottom-right",
                });
                lastCreditSubmissionId.current = JSON.stringify(creditFetcher.data);
                setEditingCredits(null);
                revalidator.revalidate();
            }
        } else if (creditFetcher.state === "idle" && creditFetcher.data?.error) {
            if (lastCreditSubmissionId.current !== JSON.stringify(creditFetcher.data)) {
                toast.error(`Error: ${creditFetcher.data.error}`, {
                    duration: 3000,
                    position: "bottom-right",
                });
                lastCreditSubmissionId.current = JSON.stringify(creditFetcher.data);
            }
        }
    }, [creditFetcher.data, creditFetcher.state, revalidator]);

    // Handle tag operations
    useEffect(() => {
        if (tagFetcher.state === "idle" && tagFetcher.data?.success) {
            if (lastTagSubmissionId.current !== JSON.stringify(tagFetcher.data)) {
                toast.success("Etiqueta actualizada", {
                    duration: 1500,
                    position: "bottom-right",
                });
                lastTagSubmissionId.current = JSON.stringify(tagFetcher.data);
                setAddingTagFor(null);
                setNewTagText("");
                revalidator.revalidate();
            }
        } else if (tagFetcher.state === "idle" && tagFetcher.data?.error) {
            if (lastTagSubmissionId.current !== JSON.stringify(tagFetcher.data)) {
                toast.error(`Error: ${tagFetcher.data.error}`, {
                    duration: 3000,
                    position: "bottom-right",
                });
                lastTagSubmissionId.current = JSON.stringify(tagFetcher.data);
            }
        }
    }, [tagFetcher.data, tagFetcher.state, revalidator]);

    const [activeSegment, setActiveSegment] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const filteredUsers = users.filter((u) => {
        const matchesSegment = activeSegment === "all" || u.segment === activeSegment;
        const matchesSearch = searchTerm === "" || u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSegment && matchesSearch;
    });

    const segmentColors: Record<string, string> = {
        new: "bg-sky-100 text-sky-700",
        active: "bg-green-100 text-green-700",
        at_risk: "bg-red-100 text-red-700",
        debtor: "bg-orange-100 text-orange-700",
        vip: "bg-purple-100 text-purple-700",
    };

    const segmentLabels: Record<string, string> = {
        new: "Nuevo",
        active: "Activo",
        at_risk: "En Riesgo",
        debtor: "Deudor",
        vip: "VIP",
    };

    return (
        <div className="space-y-6">
            {/* Header + Add Member */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestión de usuarios</h1>
                    <p className="text-white/50 mt-1">{users.length} miembros registrados — CRM 360°.</p>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                    <UserPlus className="w-4 h-4" />
                    Agregar Miembro
                </button>
            </div>

            {/* Modal de Agregar Miembro */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button 
                            onClick={() => setShowAddModal(false)}
                            className="absolute right-4 top-4 text-white/40 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-white mb-4">Nuevo Miembro</h2>
                        <fetcher.Form method="post" className="space-y-4">
                            <input type="hidden" name="intent" value="create_user" />
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase mb-1">Nombre Completo</label>
                                <input name="full_name" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="Ej. Juan Pérez" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase mb-1">Email</label>
                                <input name="email" type="email" required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="juan@ejemplo.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase mb-1">Contraseña (Opcional)</label>
                                <input name="password" type="password" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="Mínimo 6 caracteres" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/40 uppercase mb-1">Vincular Plan (Créditos)</label>
                                <select name="planId" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white appearance-none">
                                    <option value="none" className="bg-slate-900 text-white">Sin plan (Solo registro)</option>
                                    {plans?.map((plan: any) => (
                                        <option key={plan.id} value={plan.id} className="bg-slate-900 text-white">
                                            {plan.name} — ${plan.price.toLocaleString("es-MX")} ({plan.credits ?? "∞"} créditos, {plan.validity_days}d)
                                        </option>
                                    ))}
                                </select>
                                {(!plans || plans.length === 0) && (
                                    <p className="text-xs text-amber-400 mt-1">No hay planes creados. Ve a Planes para crear tus paquetes.</p>
                                )}
                            </div>

                            {fetcher.data?.error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-xs text-red-500 text-center font-bold">{fetcher.data.error}</p>
                                </div>
                            )}

                            {fetcher.data?.success && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                                    <p className="text-xs text-green-500 text-center font-bold">¡Usuario creado con éxito!</p>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={fetcher.state !== "idle"}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
                            >
                                {fetcher.state !== "idle" ? "Creando..." : "Crear Perfil"}
                            </button>
                        </fetcher.Form>
                    </div>
                </div>
            )}

            {/* Search + Segment Tabs */}
            <div className="space-y-3">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/[0.08] rounded-lg text-sm"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setActiveSegment("all")}
                        className={`text-sm px-4 py-1.5 rounded-full font-medium transition-all ${activeSegment === "all" ? "bg-white text-slate-950" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                        Todos <span className="ml-1.5 text-xs opacity-70">{users.length}</span>
                    </button>
                    {["vip", "new", "at_risk", "debtor"].map((seg) => (
                        <button
                            key={seg}
                            onClick={() => setActiveSegment(seg)}
                            className={`text-sm px-4 py-1.5 rounded-full font-medium transition-all ${activeSegment === seg ? "bg-white text-slate-950" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                        >
                            {segmentLabels[seg]}
                            <span className="ml-1.5 text-xs opacity-70">
                                {users.filter(u => u.segment === seg).length}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white/5 border border-white/[0.08] rounded-xl shadow-sm">
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/[0.08] text-white/50 text-left bg-white/5">
                                <th className="px-4 py-3 font-medium rounded-tl-xl text-white/40">Usuario</th>
                                <th className="px-4 py-3 font-medium">Segmento</th>
                                <th className="px-4 py-3 font-medium">Asistencia</th>
                                <th className="px-4 py-3 font-medium">Membresía</th>
                                <th className="px-4 py-3 font-medium">Créditos</th>
                                <th className="px-4 py-3 font-medium">Tags</th>
                                <th className="px-4 py-3 font-medium rounded-tr-xl text-white/40 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user) => {
                                const isExpired = user.membership && new Date(user.membership.end_date) < new Date();

                                return (
                                    <tr key={user.id} className="hover:bg-white/5">
                                        {/* User info */}
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-white">{user.full_name}</p>
                                            <p className="text-xs text-white/40">{user.email}</p>
                                        </td>

                                        {/* Segment badge */}
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${segmentColors[user.segment]}`}>
                                                {segmentLabels[user.segment]}
                                            </span>
                                        </td>

                                        {/* Attendance semaphore */}
                                        <td className="px-4 py-3">
                                            <AttendanceSemaphore daysAgo={user.lastVisitDaysAgo} />
                                        </td>

                                        {/* Membership */}
                                        <td className="px-4 py-3">
                                            {user.membership ? (
                                                <div>
                                                    <p className={`text-xs font-medium ${isExpired ? "text-red-500" : "text-white/70"}`}>
                                                        {user.membership.plan_name}
                                                    </p>
                                                    <p className={`text-xs ${isExpired ? "text-red-400" : "text-white/40"}`}>
                                                        {isExpired ? "Vencida" : `Vence ${new Date(user.membership.end_date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-white/40">Sin membresía</span>
                                            )}
                                        </td>

                                        {/* Credits */}
                                        <td className="px-4 py-3">
                                            {editingCredits?.userId === user.id ? (
                                                <creditFetcher.Form method="post" className="flex items-center gap-1">
                                                    <input type="hidden" name="intent" value="update_credits" />
                                                    <input type="hidden" name="userId" value={user.id} />
                                                    <input type="hidden" name="credits" value={editingCredits?.value ?? 0} />
                                                    <input
                                                        type="number"
                                                        value={editingCredits?.value ?? 0}
                                                        onChange={(e) => setEditingCredits({ userId: user.id, value: parseInt(e.target.value) || 0 })}
                                                        min={0}
                                                        className="w-14 bg-white/5 border border-blue-400 rounded px-2 py-1 text-center text-xs text-white"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={creditFetcher.state !== "idle"}
                                                        className="p-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50"
                                                        title="Confirmar"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingCredits(null)}
                                                        className="p-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                                        title="Cancelar"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </creditFetcher.Form>
                                            ) : (
                                                <button
                                                    onClick={() => setEditingCredits({ userId: user.id, value: user.credits })}
                                                    className="text-sm font-semibold text-blue-600 hover:text-blue-400 transition-colors"
                                                >
                                                    {user.credits} <span className="text-xs text-white/40">créditos</span>
                                                </button>
                                            )}
                                        </td>

                                        {/* Tags */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1 items-center max-w-48">
                                                {user.tags.map((tag: string, i: number) => (
                                                    <span
                                                        key={i}
                                                        className="inline-flex items-center gap-1 text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full group"
                                                    >
                                                        <Tag className="w-2.5 h-2.5" />
                                                        {tag}
                                                        <tagFetcher.Form method="post" className="inline">
                                                            <input type="hidden" name="intent" value="remove_tag" />
                                                            <input type="hidden" name="userId" value={user.id} />
                                                            <input type="hidden" name="tag" value={tag} />
                                                            <button
                                                                type="submit"
                                                                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </tagFetcher.Form>
                                                    </span>
                                                ))}
                                                {addingTagFor === user.id ? (
                                                    <tagFetcher.Form method="post" className="inline-flex items-center gap-1">
                                                        <input type="hidden" name="intent" value="add_tag" />
                                                        <input type="hidden" name="userId" value={user.id} />
                                                        <input
                                                            type="text"
                                                            name="tag"
                                                            value={newTagText}
                                                            onChange={(e) => setNewTagText(e.target.value)}
                                                            placeholder="Nueva etiqueta"
                                                            className="w-24 bg-white/5 border border-violet-400 rounded px-2 py-0.5 text-xs text-white"
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="submit"
                                                            disabled={!newTagText.trim()}
                                                            className="p-0.5 bg-violet-600 hover:bg-violet-700 text-white rounded disabled:opacity-50"
                                                        >
                                                            <Check className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setAddingTagFor(null); setNewTagText(""); }}
                                                            className="p-0.5 bg-red-600 hover:bg-red-700 text-white rounded"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </tagFetcher.Form>
                                                ) : (
                                                    <button
                                                        onClick={() => setAddingTagFor(user.id)}
                                                        className="text-[10px] text-violet-400 hover:text-violet-300 border border-dashed border-violet-500/30 hover:border-violet-400 px-2 py-0.5 rounded-full transition-all"
                                                    >
                                                        + Agregar
                                                    </button>
                                                )}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 relative">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {user.lastVisitDaysAgo > 14 && user.phone && (
                                                    <a
                                                        href={`https://wa.me/${user.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${user.full_name.split(" ")[0]}, ¡te extrañamos! 💪`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 py-1 rounded-lg font-medium transition-colors"
                                                        title="Enviar WhatsApp"
                                                    >
                                                        <PhoneForwarded className="w-3 h-3" />
                                                    </a>
                                                )}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                                                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                                                        title="Más acciones"
                                                    >
                                                        <MoreVertical className="w-3.5 h-3.5" />
                                                    </button>
                                                    {actionMenuOpen === user.id && (
                                                        <>
                                                            <div
                                                                className="fixed inset-0 z-10"
                                                                onClick={() => setActionMenuOpen(null)}
                                                            />
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-2xl z-20 overflow-hidden">
                                                                <a
                                                                    href={`mailto:${user.email}`}
                                                                    className="flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors"
                                                                    onClick={() => setActionMenuOpen(null)}
                                                                >
                                                                    <Mail className="w-3.5 h-3.5" />
                                                                    Enviar email
                                                                </a>
                                                                <button
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(user.id);
                                                                        toast.success("ID copiado");
                                                                        setActionMenuOpen(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors text-left"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    Copiar ID
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const info = `Nombre: ${user.full_name}\nEmail: ${user.email}\nCréditos: ${user.credits}\nTeléfono: ${user.phone || 'N/A'}`;
                                                                        navigator.clipboard.writeText(info);
                                                                        toast.success("Info copiada");
                                                                        setActionMenuOpen(null);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/10 transition-colors text-left"
                                                                >
                                                                    <FileText className="w-3.5 h-3.5" />
                                                                    Copiar info completa
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                    <div className="p-8 text-center text-white/40 text-sm">
                        No se encontraron usuarios.
                    </div>
                )}
            </div>
        </div>
    );
}
