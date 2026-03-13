// app/routes/admin/users.tsx
// Admin – CRM User Management with segmentation, attendance semaphore, and tags (MOCK DATA).
// Auth and Server services moved to dynamic imports inside loader/action
import type { Route } from "./+types/users";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { Search, PhoneForwarded, Tag, X, UserPlus } from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────
// Server services moved to dynamic imports

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { PLAN_CATALOG } = await import("~/services/subscription.server");

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
        return { users: [] };
    }

    // Map DB data to CRMUser interface
    const mappedUsers = (users || []).map(u => {
        const membership = u.memberships && Array.isArray(u.memberships) ? u.memberships[0] : null;
        const lastVisitDaysAgo = 0; // Mocked for now until attendance is real
        
        let segment: any = "new";
        if (u.credits > 10) segment = "vip";
        else if (membership?.status === "active") segment = "active";
        
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
            tags: [],
            totalSpent: 0
        };
    });

    return { 
        users: mappedUsers,
        plans: PLAN_CATALOG
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { PLAN_CATALOG, createMembership } = await import("~/services/subscription.server");

    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create_user") {
        const email = formData.get("email") as string;
        const full_name = formData.get("full_name") as string;
        const password = formData.get("password") as string || "Grind2026!";
        const planId = formData.get("planId") as string;

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

        // Integrated Plan Assignment
        if (planId && planId !== "none") {
            const plan = PLAN_CATALOG.find(p => p.id === planId);
            if (plan) {
                try {
                    await createMembership({
                        userId: data.user.id,
                        gymId: gymId,
                        planName: plan.name,
                        price: plan.price,
                        credits: plan.credits,
                        months: 1
                    });
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
    const [showAddModal, setShowAddModal] = useState(false);

    // Close modal on success
    useEffect(() => {
        if (fetcher.data?.success && fetcher.state === "idle") {
            const timer = setTimeout(() => setShowAddModal(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [fetcher.data, fetcher.state]);
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
                                            {plan.name} — ${plan.price} ({plan.credits} creds)
                                        </option>
                                    ))}
                                </select>
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
            <div className="bg-white/5 border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/[0.08] text-white/50 text-left bg-white/5">
                                <th className="px-4 py-3 font-medium">Usuario</th>
                                <th className="px-4 py-3 font-medium">Segmento</th>
                                <th className="px-4 py-3 font-medium">Asistencia</th>
                                <th className="px-4 py-3 font-medium">Membresía</th>
                                <th className="px-4 py-3 font-medium">Créditos</th>
                                <th className="px-4 py-3 font-medium">Tags</th>
                                <th className="px-4 py-3 font-medium">Acciones</th>
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
                                            <fetcher.Form method="post" className="flex items-center gap-1.5">
                                                <input type="hidden" name="intent" value="update_credits" />
                                                <input type="hidden" name="userId" value={user.id} />
                                                <input
                                                    type="number"
                                                    name="credits"
                                                    defaultValue={user.credits}
                                                    min={0}
                                                    className="w-16 bg-white/5 border border-white/[0.08] rounded px-2 py-1 text-center text-xs"
                                                />
                                                <button type="submit" className="text-xs text-blue-600 hover:text-blue-800 font-medium">✓</button>
                                            </fetcher.Form>
                                        </td>

                                        {/* Tags */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1 max-w-48">
                                                {user.tags.map((tag, i) => (
                                                    <span key={i} className="inline-flex items-center gap-0.5 text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                                                        <Tag className="w-2.5 h-2.5" />
                                                        {tag}
                                                    </span>
                                                ))}
                                                {user.tags.length === 0 && <span className="text-xs text-white/30">—</span>}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                {user.lastVisitDaysAgo > 14 && (
                                                    <a
                                                        href={`https://wa.me/${user.phone.replace(/\+/g, "")}?text=${encodeURIComponent(`Hola ${user.full_name.split(" ")[0]}, ¡te extrañamos! 💪`)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                                    >
                                                        <PhoneForwarded className="w-3 h-3" />
                                                        WhatsApp
                                                    </a>
                                                )}
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
