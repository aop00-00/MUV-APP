// app/routes/admin/crm.tsx
// CRM – Lead pipeline in a visual Kanban board.
// 5 stages: Nuevo → Contactado → Trial → Convertido → Perdido

import type { Route } from "./+types/crm";
import { useFetcher } from "react-router";
import { useState, useEffect } from "react";
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    defaultDropAnimationSideEffects,
    useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    Instagram, Globe, Users, UserCheck, TrendingUp,
    Phone, Mail, MessageCircle, ChevronRight, Plus, X, Clock
} from "lucide-react";
// Auth and DB services moved to dynamic imports inside loader/action
import { toast } from "react-hot-toast";

// Types used locally (matching database.ts Lead type)
type LeadStage = "new" | "contacted" | "trial" | "converted" | "lost";
type LeadSource = "instagram" | "referral" | "web" | "walk_in" | "facebook" | "google";
interface Lead {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    source: LeadSource;
    stage: LeadStage;
    notes: string | null;
    assigned_to: string | null;
    days_in_stage: number;
    gym_id?: string;
    created_at: string;
    updated_at: string;
}

const STAGES: { key: LeadStage; label: string; color: string; border: string; icon: React.ElementType }[] = [
    { key: "new", label: "Nuevos", color: "text-blue-500", border: "border-blue-500/30", icon: Users },
    { key: "contacted", label: "Contactados", color: "text-violet-500", border: "border-violet-500/30", icon: MessageCircle },
    { key: "trial", label: "Trial", color: "text-amber-500", border: "border-amber-500/30", icon: Clock },
    { key: "converted", label: "Convertidos", color: "text-green-500", border: "border-green-500/30", icon: UserCheck },
    { key: "lost", label: "Perdidos", color: "text-slate-400", border: "border-white/[0.08]", icon: X },
];

const SOURCE_ICONS: Record<LeadSource, { icon: React.ElementType; label: string; color: string }> = {
    instagram: { icon: Instagram, label: "Instagram", color: "text-pink-500" },
    referral: { icon: Users, label: "Referido", color: "text-violet-500" },
    web: { icon: Globe, label: "Web", color: "text-blue-500" },
    walk_in: { icon: UserCheck, label: "Walk-in", color: "text-green-500" },
    facebook: { icon: Globe, label: "Facebook", color: "text-blue-600" },
    google: { icon: Globe, label: "Google", color: "text-red-500" },
};

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/crm");

    const { data: leads, error } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("gym_id", gymId)
        .order("created_at", { ascending: false });

    if (error) console.error("[crm] Error fetching leads:", error);

    // Calculate days_in_stage from updated_at (DB stores 0 by default)
    const allLeads = (leads ?? []).map((l: any) => ({
        ...l,
        days_in_stage: Math.max(0, Math.floor((Date.now() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24))),
    })) as Lead[];

    const total = allLeads.length;
    const converted = allLeads.filter((l) => l.stage === "converted").length;
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    const newThisWeek = allLeads.filter((l) => {
        const daysSinceCreated = Math.floor((Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceCreated <= 7 && l.stage === "new";
    }).length;

    return { leads: allLeads, stats: { total, converted, conversionRate, newThisWeek } };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "move_stage") {
        const leadId = formData.get("leadId") as string;
        const newStage = formData.get("stage") as string;

        const { error } = await supabaseAdmin
            .from("leads")
            .update({ stage: newStage, updated_at: new Date().toISOString() })
            .eq("id", leadId)
            .eq("gym_id", gymId);

        if (error) {
            console.error("[crm] Error updating lead stage:", error);
            return { success: false, error: "No se pudo actualizar el estado en la base de datos." };
        }

        return { success: true, intent };
    }

    if (intent === "add_lead") {
        const full_name = formData.get("full_name") as string;
        const email = formData.get("email") as string;
        const phone = formData.get("phone") as string || null;
        const source = formData.get("source") as string;
        const notes = formData.get("notes") as string || null;

        const { error } = await supabaseAdmin
            .from("leads")
            .insert({
                gym_id: gymId,
                full_name,
                email,
                phone,
                source,
                stage: "new",
                notes,
            });

        if (error) {
            console.error("[crm] Error creating new lead:", error);
            return { success: false, error: "Error al crear el lead en la base de datos." };
        }

        return { success: true, intent };
    }

    if (intent === "delete_lead") {
        const leadId = formData.get("leadId") as string;

        const { error } = await supabaseAdmin
            .from("leads")
            .delete()
            .eq("id", leadId)
            .eq("gym_id", gymId);

        if (error) {
            console.error("[crm] Error deleting lead:", error);
            return { success: false, error: "Error al eliminar el lead." };
        }
        return { success: true, intent };
    }

    if (intent === "update_notes") {
        const leadId = formData.get("leadId") as string;
        const notes = formData.get("notes") as string;

        const { error } = await supabaseAdmin
            .from("leads")
            .update({ notes, updated_at: new Date().toISOString() })
            .eq("id", leadId)
            .eq("gym_id", gymId);

        if (error) return { success: false, error: "Error al actualizar notas." };
        return { success: true, intent };
    }

    return { success: false, error: "Intent no soportado" };
}

// ─── Lead Card & Column ───────────────────────────────────────────
function LeadCard({ lead, isOverlay }: { lead: Lead; isOverlay?: boolean }) {
    const fetcher = useFetcher();
    const [expanded, setExpanded] = useState(false);
    const srcInfo = SOURCE_ICONS[lead.source];
    const SrcIcon = srcInfo.icon;

    const NEXT_STAGE: Partial<Record<LeadStage, LeadStage>> = {
        new: "contacted", contacted: "trial", trial: "converted",
    };
    const nextStage = NEXT_STAGE[lead.stage];

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id, data: { type: "Lead", lead } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isOverlay ? undefined : transition,
    };

    if (isDragging && !isOverlay) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="opacity-40 border-2 border-dashed border-white/30 bg-white/[0.02] rounded-xl min-h-[140px]"
            />
        );
    }

    let dynamicClasses = "bg-[#111111] border border-white/[0.05] shadow-sm rounded-xl p-3 sm:p-4 hover:border-white/10 hover:bg-[#161616] transition-all cursor-grab active:cursor-grabbing group min-w-[260px]";

    if (isOverlay) {
        dynamicClasses = "bg-[#1a1a1a] border border-violet-500/30 shadow-[0_20px_40px_-10px_rgba(124,58,237,0.15)] rounded-xl p-3 sm:p-4 cursor-grabbing min-w-[260px] rotate-2 scale-[1.03] z-50 pointer-events-none";
    }

    return (
        <div
            ref={isOverlay ? undefined : setNodeRef}
            style={isOverlay ? undefined : style}
            {...(isOverlay ? {} : attributes)}
            {...(isOverlay ? {} : listeners)}
            className={dynamicClasses}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="font-bold text-white text-[15px] truncate">{lead.full_name}</p>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-md bg-white/5 ${srcInfo.color} shrink-0`} title={srcInfo.label}>
                        <SrcIcon className="w-3.5 h-3.5" />
                    </div>
                </div>

                {lead.notes ? (
                    <p className="text-[13px] text-white/60 font-medium leading-snug line-clamp-2 mb-3">
                        {lead.notes}
                    </p>
                ) : (
                    <p className="text-[13px] text-white/30 italic font-medium leading-snug mb-3">
                        Sin notas adicionales.
                    </p>
                )}

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/40 flex items-center gap-1 uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md shrink-0">
                        <Clock className="w-3 h-3" />
                        {lead.days_in_stage}d
                    </span>

                    <div className="flex items-center gap-1.5 ml-auto pointer-events-auto">
                        {lead.phone && (
                            <a
                                href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md bg-white/5 text-[#25D366] hover:bg-white/10 transition-colors"
                                title="WhatsApp"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Phone className="w-3.5 h-3.5" />
                            </a>
                        )}
                        <a
                            href={`mailto:${lead.email}`}
                            className="p-1.5 rounded-md bg-white/5 text-blue-400 hover:bg-white/10 transition-colors"
                            title="Email"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Mail className="w-3.5 h-3.5" />
                        </a>
                        {nextStage && (
                            <fetcher.Form method="post" onSubmit={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <input type="hidden" name="intent" value="move_stage" />
                                <input type="hidden" name="leadId" value={lead.id} />
                                <input type="hidden" name="stage" value={nextStage} />
                                <button
                                    type="submit"
                                    className="p-1.5 rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center shrink-0 ml-1"
                                    title={`Mover a ${STAGES.find(s => s.key === nextStage)?.label}`}
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </fetcher.Form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function DroppableColumn({ stage, stageLeads }: { stage: typeof STAGES[0], stageLeads: Lead[] }) {
    const { setNodeRef, isOver } = useDroppable({
        id: stage.key,
        data: { type: "Column", stage: stage.key }
    });

    return (
        <div
            ref={setNodeRef}
            className={`snap-center min-w-[280px] lg:min-w-0 rounded-2xl bg-[#0F0F11] border border-white/[0.04] p-3 transition-colors flex flex-col min-h-[600px] relative overflow-hidden ${isOver ? "bg-[#1A1A1E] border-white/20" : ""
                }`}
        >
            <div className={`absolute top-0 left-0 w-full h-1 opacity-50 ${stage.border.replace('border-', 'bg-').split('/')[0]}`} />

            <div className="flex items-center justify-between mb-4 mt-1 px-1">
                <span className="text-xs font-black text-white/70 uppercase tracking-widest">{stage.label}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 text-white/50 bg-white/5`}>
                    {stageLeads.length}
                </span>
            </div>

            <div className="space-y-2 flex-1 relative">
                <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {stageLeads.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center p-6 text-white/40 text-[11px] border-2 border-dashed border-white/[0.05] rounded-xl font-medium tracking-wide">
                            Soltar leads aquí
                        </div>
                    ) : (
                        stageLeads.map((lead) => (
                            <LeadCard key={lead.id} lead={lead} />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AdminCRM({ loaderData }: Route.ComponentProps) {
    const { leads, stats } = loaderData;
    const [showAddForm, setShowAddForm] = useState(false);
    const [localLeads, setLocalLeads] = useState<Lead[]>(leads);
    const [activeId, setActiveId] = useState<string | null>(null);
    const fetcher = useFetcher<typeof action>();

    // Support automatic rollback and toast notifications from fetcher errors
    useEffect(() => {
        if (fetcher.data) {
            if (fetcher.data.success === false && fetcher.data.error) {
                if (typeof document !== "undefined") {
                    try {
                        toast.error(fetcher.data.error, {
                            style: { background: '#1F1F22', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
                        });
                    } catch (e) { console.error(fetcher.data.error); }
                }
            } else if (fetcher.data.success && fetcher.data.intent === "add_lead") {
                setShowAddForm(false);
                if (typeof document !== "undefined") {
                    try {
                        toast.success("Lead agregado correctamente", {
                            style: { background: '#1F1F22', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
                        });
                    } catch (e) { }
                }
            }
        }
    }, [fetcher.data]);

    // Resync local state with loader data when loader data changes
    // This provides the automatic rollback mechanism if the server didn't mutate the data
    useEffect(() => {
        setLocalLeads(leads);
    }, [leads]);

    const getLeadsByStage = (stage: LeadStage) => localLeads.filter((l) => l.stage === stage);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (e: DragStartEvent) => {
        setActiveId(e.active.id as string);
    };

    const handleDragOver = (e: DragOverEvent) => {
        const { active, over } = e;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveLead = active.data.current?.type === "Lead";
        const isOverLead = over.data.current?.type === "Lead";
        const isOverColumn = over.data.current?.type === "Column";

        if (!isActiveLead) return;

        setLocalLeads((prev) => {
            const activeLead = prev.find(l => l.id === activeId);
            if (!activeLead) return prev;

            if (isOverLead) {
                const overLead = prev.find(l => l.id === overId);
                if (overLead && overLead.stage !== activeLead.stage) {
                    return prev.map(l => l.id === activeId ? { ...l, stage: overLead.stage } : l);
                } else if (overLead && overLead.stage === activeLead.stage) {
                    const activeIndex = prev.findIndex(l => l.id === activeId);
                    const overIndex = prev.findIndex(l => l.id === overId);
                    return arrayMove(prev, activeIndex, overIndex);
                }
            }

            if (isOverColumn) {
                const targetStage = over.data.current?.stage as LeadStage;
                if (targetStage && activeLead.stage !== targetStage) {
                    return prev.map(l => l.id === activeId ? { ...l, stage: targetStage } : l);
                }
            }

            return prev;
        });
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = e;
        if (!over) return;

        const activeLeadId = active.id as string;
        const originalLead = leads.find(l => l.id === activeLeadId);

        let newStage: LeadStage | null = null;
        if (over.data.current?.type === "Lead") {
            newStage = over.data.current?.lead?.stage;
        } else if (over.data.current?.type === "Column") {
            newStage = over.data.current?.stage as LeadStage;
        }

        if (newStage && originalLead && newStage !== originalLead.stage) {
            fetcher.submit(
                { intent: "move_stage", leadId: activeLeadId, stage: newStage },
                { method: "post" }
            );
        }
    };

    const activeLead = activeId ? localLeads.find((l) => l.id === activeId) : null;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">CRM Command Center</h1>
                    <p className="text-white/40 text-sm font-medium mt-1">Monitorea y arrastra leads a través de tu embudo de ventas.</p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200 px-5 py-2.5 rounded-xl text-sm font-bold transition-transform hover:scale-105 active:scale-95 shadow-xl"
                >
                    <Plus className="w-4 h-4" />
                    Nuevo lead
                </button>
            </div>

            {/* ── KPI Strip (Command Center Style) ───────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                <div className="bg-[#111111] p-5 rounded-2xl border border-white/[0.05] shadow-lg flex flex-col justify-between min-h-[100px]">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Leads totales</p>
                    <p className="text-4xl font-black text-white tracking-tighter mt-2">{stats.total}</p>
                </div>
                <div className="bg-[#111111] p-5 rounded-2xl border border-white/[0.05] shadow-lg flex flex-col justify-between min-h-[100px]">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Nuevos (Semana)</p>
                    <p className="text-4xl font-black text-blue-500 tracking-tighter mt-2">{stats.newThisWeek}</p>
                </div>
                <div className="bg-[#111111] p-5 rounded-2xl border border-white/[0.05] shadow-lg flex flex-col justify-between min-h-[100px]">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Convertidos</p>
                    <p className="text-4xl font-black text-green-500 tracking-tighter mt-2">{stats.converted}</p>
                </div>
                <div className="bg-[#111111] p-5 rounded-2xl border border-white/[0.05] shadow-lg flex flex-col justify-between min-h-[100px]">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Tasa Conv.</p>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-4xl font-black text-violet-500 tracking-tighter">{stats.conversionRate}%</p>
                        <TrendingUp className="w-5 h-5 text-violet-500/50" />
                    </div>
                </div>
            </div>

            {/* ── Add Lead Form ───────────────────────── */}
            {showAddForm && (
                <div className="bg-white/5 border border-white/[0.08] rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Agregar lead</h2>
                        <button onClick={() => setShowAddForm(false)} className="text-white/40 hover:text-white/60">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <fetcher.Form method="post" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input type="hidden" name="intent" value="add_lead" />
                        <div>
                            <label className="block text-xs text-white/50 mb-1">Nombre completo</label>
                            <input name="full_name" required className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm" placeholder="Juan Pérez" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1">Email</label>
                            <input name="email" type="email" required className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm" placeholder="juan@gmail.com" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1">Teléfono (opcional)</label>
                            <input name="phone" className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm" placeholder="+52 55 0000 0000" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1">Fuente</label>
                            <select name="source" className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm">
                                <option value="instagram">Instagram</option>
                                <option value="referral">Referido</option>
                                <option value="web">Web</option>
                                <option value="walk_in">Walk-in</option>
                                <option value="facebook">Facebook</option>
                                <option value="google">Google</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-white/50 mb-1">Notas</label>
                            <input name="notes" className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm" placeholder="Le interesa el plan Elite…" />
                        </div>
                        <div className="md:col-span-3">
                            <button type="submit" className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors">
                                Agregar lead
                            </button>
                        </div>
                    </fetcher.Form>
                </div>
            )}

            {/* ── Kanban Board (Strict Grid) ─────────────────────────── */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 md:flex md:flex-nowrap lg:grid lg:grid-cols-5 gap-3 lg:gap-4 overflow-x-auto pb-6 snap-x snap-mandatory mb-4 hide-scrollbar">
                    {STAGES.map((stage) => {
                        const stageLeads = getLeadsByStage(stage.key);
                        return <DroppableColumn key={stage.key} stage={stage} stageLeads={stageLeads} />;
                    })}
                </div>

                <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } })
                }}>
                    {activeLead ? <LeadCard lead={activeLead} isOverlay /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
