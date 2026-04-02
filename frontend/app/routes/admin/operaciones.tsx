// admin/operaciones.tsx — Mi Estudio > Operaciones (rooms + class types)
// If the studio is equipment-limited (cycling, pilates, barre, yoga),
// the "Nueva sala" modal has a Step 2 where the admin designs the seat/equipment map.

import { useState, useEffect } from "react";
import { Wrench, Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { useFetcher, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/operaciones";
import { EditableSeatMap, type LayoutGrid } from "~/components/SeatMap";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280", "#0EA5E9"];

// Studio types that require a layout map
const LAYOUT_DISCIPLINES = ["cycling", "pilates", "barre", "yoga"];

function needsLayoutEditor(studioType?: string | null) {
    return LAYOUT_DISCIPLINES.includes(studioType ?? "");
}

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { getGymRooms, getGymClassTypes } = await import("~/services/room.server");
    const { getGymLocations } = await import("~/services/location.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requirePlanAccess(request, "/admin/operaciones");

    const [rooms, classTypes, locations, gymResult] = await Promise.all([
        getGymRooms(gymId),
        getGymClassTypes(gymId),
        getGymLocations(gymId),
        supabaseAdmin.from("gyms").select("studio_type, booking_mode, brand_color, primary_color").eq("id", gymId).single(),
    ]);

    return {
        rooms,
        classTypes,
        locations,
        studioType: gymResult.data?.studio_type || null,
        bookingMode: gymResult.data?.booking_mode || "capacity_only",
        brandColor: gymResult.data?.brand_color || gymResult.data?.primary_color || "#7c3aed",
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { createRoom, toggleRoom, deleteRoom, createClassType, deleteClassType } = await import("~/services/room.server");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create_room") {
        const layoutConfigRaw = formData.get("layout_config") as string;
        const resourcesRaw = formData.get("resources_json") as string;

        let layoutConfig = null;
        let resources = undefined;
        try {
            if (layoutConfigRaw) layoutConfig = JSON.parse(layoutConfigRaw);
            if (resourcesRaw) resources = JSON.parse(resourcesRaw);
        } catch {
            // ignore parse errors
        }

        await createRoom({
            gymId,
            name: formData.get("name") as string,
            locationId: formData.get("locationId") as string || null,
            capacity: parseInt(formData.get("capacity") as string, 10) || 8,
            equipment: formData.get("equipment") as string || null,
            layoutConfig,
            resources,
        });
        return { success: true, intent };
    }

    if (intent === "toggle_room") {
        const roomId = formData.get("roomId") as string;
        const isActive = formData.get("isActive") === "true";
        await toggleRoom(roomId, gymId, isActive);
        return { success: true, intent };
    }

    if (intent === "delete_room") {
        await deleteRoom(formData.get("roomId") as string, gymId);
        return { success: true, intent };
    }

    if (intent === "create_class_type") {
        await createClassType({
            gymId,
            name: formData.get("name") as string,
            color: formData.get("color") as string,
            duration: parseInt(formData.get("duration") as string, 10) || 50,
            creditsRequired: parseInt(formData.get("creditsRequired") as string, 10) || 1,
            description: formData.get("description") as string || null,
        });
        return { success: true, intent };
    }

    if (intent === "delete_class_type") {
        await deleteClassType(formData.get("classTypeId") as string, gymId);
        return { success: true, intent };
    }

    return { success: true, intent };
}

// ─── Room Modal ──────────────────────────────────────────────────
interface RoomModalProps {
    locations: { id: string; name: string }[];
    studioType: string | null;
    brandColor: string;
    onClose: () => void;
    onSave: (data: {
        name: string;
        locationId: string;
        capacity: number;
        equipment: string;
        layoutConfig: object | null;
        resourcesJson: string | null;
    }) => void;
    loading: boolean;
}

function RoomModal({ locations, studioType, brandColor, onClose, onSave, loading }: RoomModalProps) {
    const usesLayout = needsLayoutEditor(studioType);
    const [step, setStep] = useState<1 | 2>(1);
    const [form, setForm] = useState({ name: "", locationId: "", capacity: 8, equipment: "" });

    // Layout editor state
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(4);
    const [grid, setGrid] = useState<LayoutGrid>({});

    function getResourceLabel() {
        const map: Record<string, string> = { cycling: "Bike", pilates: "Reformer", barre: "Barra", yoga: "Mat" };
        return map[studioType ?? ""] ?? "Lugar";
    }

    function getResourceType() {
        const map: Record<string, string> = { cycling: "bike", pilates: "reformer", barre: "barre", yoga: "mat" };
        return map[studioType ?? ""] ?? "spot";
    }

    function handleSave() {
        if (usesLayout) {
            const activeSlots = Object.entries(grid)
                .filter(([, c]) => c.active)
                .map(([key, c]) => {
                    const [row, col] = key.split(",").map(Number);
                    return { row, col, name: c.name, resourceType: getResourceType() };
                });

            const layoutConfig = { rows, cols, slots: activeSlots };
            onSave({
                ...form,
                layoutConfig,
                resourcesJson: JSON.stringify(activeSlots),
            });
        } else {
            onSave({ ...form, layoutConfig: null, resourcesJson: null });
        }
    }

    const canGoToStep2 = form.name.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-white">Nueva sala</h2>
                        {usesLayout && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${step === 1 ? "text-white" : "text-white/30"}`}
                                    style={step === 1 ? { backgroundColor: brandColor } : {}}>
                                    1 Info general
                                </span>
                                <ChevronRight className="w-3 h-3 text-white/30" />
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${step === 2 ? "text-white" : "text-white/30"}`}
                                    style={step === 2 ? { backgroundColor: brandColor } : {}}>
                                    2 Diseñar mapa
                                </span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder={studioType === "cycling" ? "Sala de Spinning A" : "Sala Principal"}
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-white/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Sede</label>
                                <select
                                    value={form.locationId}
                                    onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                                >
                                    <option value="">Sin sede asignada</option>
                                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">
                                    {usesLayout ? `Capacidad (número de ${getResourceLabel()}s)` : "Capacidad"}
                                </label>
                                <input
                                    type="number"
                                    value={form.capacity}
                                    onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))}
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Equipamiento</label>
                                <input
                                    value={form.equipment}
                                    onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}
                                    placeholder="Reformers, espejos, barras..."
                                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-white/20"
                                />
                            </div>
                            {usesLayout && (
                                <div className="mt-2 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                                    <p className="text-xs text-white/50">
                                        Tu estudio es <strong className="text-white/70">{studioType}</strong> — en el siguiente paso podrás diseñar visualmente dónde va cada {getResourceLabel().toLowerCase()}.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && usesLayout && (
                        <div className="space-y-4">
                            <EditableSeatMap
                                rows={rows}
                                cols={cols}
                                grid={grid}
                                onChange={setGrid}
                                brandColor={brandColor}
                                studioType={studioType}
                                onRowsChange={setRows}
                                onColsChange={setCols}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex gap-3">
                    {step === 2 && (
                        <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-1.5 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" /> Atrás
                        </button>
                    )}
                    {step === 1 && (
                        <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-medium text-white/60 hover:bg-white/5 transition-colors">
                            Cancelar
                        </button>
                    )}
                    {step === 1 && usesLayout ? (
                        <button
                            disabled={!canGoToStep2}
                            onClick={() => setStep(2)}
                            className="flex-1 flex items-center justify-center gap-1.5 text-white font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-40 transition-all"
                            style={{ backgroundColor: brandColor }}
                        >
                            Diseñar mapa <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={!form.name || loading}
                            className="flex-1 text-white font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-40 transition-all"
                            style={{ backgroundColor: "#F59E0B" }}
                        >
                            {loading ? "Guardando..." : step === 2 ? "Guardar sala y mapa" : "Guardar sala"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────
export default function Operaciones({ loaderData }: Route.ComponentProps) {
    const { rooms, classTypes, locations, studioType, bookingMode, brandColor } = loaderData;
    const fetcher = useFetcher();

    const [roomModal, setRoomModal] = useState(false);
    const [typeModal, setTypeModal] = useState(false);
    const [typeForm, setTypeForm] = useState({ name: "", color: "#3B82F6", duration: 50, creditsRequired: 1, description: "" });

    // Close modals after successful submission
    useEffect(() => {
        if (fetcher.data?.success && fetcher.state === "idle") {
            setRoomModal(false);
            setTypeModal(false);
        }
    }, [fetcher.data, fetcher.state]);

    function handleSaveRoom(data: {
        name: string;
        locationId: string;
        capacity: number;
        equipment: string;
        layoutConfig: object | null;
        resourcesJson: string | null;
    }) {
        const fd = new FormData();
        fd.set("intent", "create_room");
        fd.set("name", data.name);
        fd.set("locationId", data.locationId);
        fd.set("capacity", String(data.capacity));
        fd.set("equipment", data.equipment);
        if (data.layoutConfig) fd.set("layout_config", JSON.stringify(data.layoutConfig));
        if (data.resourcesJson) fd.set("resources_json", data.resourcesJson);
        fetcher.submit(fd, { method: "post" });
    }

    function saveType() {
        const fd = new FormData();
        fd.set("intent", "create_class_type");
        fd.set("name", typeForm.name);
        fd.set("color", typeForm.color);
        fd.set("duration", String(typeForm.duration));
        fd.set("creditsRequired", String(typeForm.creditsRequired));
        fd.set("description", typeForm.description);
        fetcher.submit(fd, { method: "post" });
    }

    function toggleRoomHandler(id: string, currentActive: boolean) {
        const fd = new FormData();
        fd.set("intent", "toggle_room");
        fd.set("roomId", id);
        fd.set("isActive", String(!currentActive));
        fetcher.submit(fd, { method: "post" });
    }

    function removeRoom(id: string) {
        const fd = new FormData();
        fd.set("intent", "delete_room");
        fd.set("roomId", id);
        fetcher.submit(fd, { method: "post" });
    }

    function removeType(id: string) {
        const fd = new FormData();
        fd.set("intent", "delete_class_type");
        fd.set("classTypeId", id);
        fetcher.submit(fd, { method: "post" });
    }

    const needsMap = needsLayoutEditor(studioType);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-white">Operaciones</h1>
                <p className="text-white/50 text-sm mt-0.5">Configura las salas de tu estudio y los tipos de clases disponibles.</p>
                {needsMap && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white/70 border border-white/10 bg-white/5">
                        <span style={{ color: brandColor }}>●</span>
                        Tu estudio es <strong className="capitalize" style={{ color: brandColor }}>{studioType}</strong> — las salas incluyen diseño visual de lugar
                    </div>
                )}
            </div>

            {/* ─── SALAS ─── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Salas</h2>
                    <button
                        onClick={() => setRoomModal(true)}
                        className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-3.5 py-2 rounded-xl text-sm transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> Nueva sala
                    </button>
                </div>

                {rooms.length === 0 ? (
                    <div className="text-center py-12 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                        <p className="text-white/40 text-sm">Sin salas. <button onClick={() => setRoomModal(true)} className="text-amber-400 font-semibold hover:underline">Agregar sala</button></p>
                    </div>
                ) : (
                    <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>{["Sala", "Sede", "Cap.", "Equipamiento", needsMap ? "Lugares" : "Estado", ""].map(h => <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rooms.map(r => (
                                    <tr key={r.id} className={`hover:bg-white/5 ${!r.is_active ? "opacity-50" : ""}`}>
                                        <td className="px-4 py-3 font-bold text-white">{r.name}</td>
                                        <td className="px-4 py-3 text-white/50 text-xs">{(r as any).location_name || "Sin sede"}</td>
                                        <td className="px-4 py-3 text-white/60">{r.capacity}</td>
                                        <td className="px-4 py-3 text-white/50 text-xs max-w-xs truncate">{r.equipment || "—"}</td>
                                        <td className="px-4 py-3">
                                            {needsMap ? (
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white/60 bg-white/10">
                                                    {(r as any).layout_config?.slots?.length ?? "—"} lugares
                                                </span>
                                            ) : (
                                                <button onClick={() => toggleRoomHandler(r.id, r.is_active)} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${r.is_active ? "bg-green-100 text-green-700" : "bg-white/10 text-white/50"}`}>
                                                    {r.is_active ? "Activa" : "Inactiva"}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => removeRoom(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── TIPOS DE CLASE ─── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Tipos de clase</h2>
                    <button onClick={() => setTypeModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-3.5 py-2 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-4 h-4" /> Nuevo tipo
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {classTypes.map(t => (
                        <div key={t.id} className="bg-white/5 rounded-xl border border-white/[0.08] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                    <p className="font-bold text-white text-sm">{t.name}</p>
                                </div>
                                <button onClick={() => removeType(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </div>
                            {t.description && <p className="text-xs text-white/50 leading-relaxed">{t.description}</p>}
                            <div className="flex items-center gap-3 text-xs text-white/50">
                                <span className="bg-white/10 px-2 py-0.5 rounded-full">{t.duration} min</span>
                                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{t.credits_required} crédito{t.credits_required > 1 ? "s" : ""}</span>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setTypeModal(true)} className="bg-white/5 border-2 border-dashed border-white/[0.08] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-amber-400 hover:bg-amber-50/5 transition-all group min-h-[120px]">
                        <Plus className="w-6 h-6 text-white/30 group-hover:text-amber-500" />
                        <span className="text-xs text-white/40 group-hover:text-amber-400 font-medium">Nuevo tipo de clase</span>
                    </button>
                </div>
            </div>

            {/* Room Modal */}
            {roomModal && (
                <RoomModal
                    locations={locations}
                    studioType={studioType}
                    brandColor={brandColor}
                    onClose={() => setRoomModal(false)}
                    onSave={handleSaveRoom}
                    loading={fetcher.state !== "idle"}
                />
            )}

            {/* Class type modal */}
            {typeModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                        <div className="p-6 border-b border-white/10"><h2 className="text-lg font-black text-white">Nuevo tipo de clase</h2></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre *</label><input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="Pilates Reformer" className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 placeholder:text-white/20" /></div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Color de identificación</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setTypeForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-lg border-2 transition-all ${typeForm.color === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Duración (min)</label><input type="number" value={typeForm.duration} onChange={e => setTypeForm(f => ({ ...f, duration: +e.target.value }))} className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Créditos requeridos</label><input type="number" value={typeForm.creditsRequired} onChange={e => setTypeForm(f => ({ ...f, creditsRequired: +e.target.value }))} className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400" /></div>
                            </div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Descripción</label><textarea value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 resize-none" /></div>
                        </div>
                        <div className="p-6 border-t border-white/10 flex gap-3">
                            <button onClick={() => setTypeModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={saveType} disabled={!typeForm.name} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
