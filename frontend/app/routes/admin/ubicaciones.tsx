// admin/ubicaciones.tsx — Mi Estudio > Ubicaciones (physical venues/branches)
import { useState, useEffect } from "react";
import { MapPin, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/ubicaciones";

const FLAG: Record<string, string> = { MX: "🇲🇽", AR: "🇦🇷", CL: "🇨🇱", CO: "🇨🇴", PE: "🇵🇪" };

const EMPTY_FORM = { name: "", address: "", city: "", country: "MX", phone: "", mapsUrl: "" };

// ─── Loader & Action ─────────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requirePlanAccess } = await import("~/services/plan-access.server");
    const { getGymLocations } = await import("~/services/location.server");
    const { gymId } = await requirePlanAccess(request, "/admin/ubicaciones");
    const locations = await getGymLocations(gymId);
    return { locations };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { createLocation, updateLocation, toggleLocation, deleteLocation, getGymLocations } = await import("~/services/location.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { PLAN_FEATURES } = await import("~/config/plan-features");
    const { gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "create") {
        // Enforce maxLocations plan limit before INSERT
        const { data: gym } = await supabaseAdmin
            .from("gyms")
            .select("plan_id")
            .eq("id", gymId)
            .single();
        const planId = (gym?.plan_id || "starter") as keyof typeof PLAN_FEATURES;
        const planDef = PLAN_FEATURES[planId];
        if (planDef?.maxLocations !== null && planDef?.maxLocations !== undefined) {
            const existingLocations = await getGymLocations(gymId);
            if (existingLocations.length >= planDef.maxLocations) {
                return {
                    success: false,
                    intent,
                    error: `Tu plan ${planDef.label} permite máximo ${planDef.maxLocations} sede${planDef.maxLocations === 1 ? "" : "s"}. Actualiza tu plan para agregar más.`,
                };
            }
        }

        try {
            await createLocation({
                gymId,
                name: formData.get("name") as string,
                address: formData.get("address") as string,
                city: formData.get("city") as string,
                country: formData.get("country") as string,
                phone: formData.get("phone") as string || null,
                mapsUrl: formData.get("mapsUrl") as string || null,
            });
        } catch (err: any) {
            return { success: false, intent, error: err.message ?? "Error al crear la sede." };
        }
        return { success: true, intent };
    }

    if (intent === "update") {
        const locationId = formData.get("locationId") as string;
        await updateLocation(locationId, gymId, {
            name: formData.get("name") as string,
            address: formData.get("address") as string,
            city: formData.get("city") as string,
            country: formData.get("country") as string,
            phone: formData.get("phone") as string || null,
            maps_url: formData.get("mapsUrl") as string || null,
        });
        return { success: true, intent };
    }

    if (intent === "toggle") {
        const locationId = formData.get("locationId") as string;
        const isActive = formData.get("isActive") === "true";
        await toggleLocation(locationId, gymId, isActive);
        return { success: true, intent };
    }

    if (intent === "delete") {
        const locationId = formData.get("locationId") as string;
        await deleteLocation(locationId, gymId);
        return { success: true, intent };
    }

    return { success: true, intent };
}

// ─── Main Component ──────────────────────────────────────────────
export default function Ubicaciones({ loaderData }: Route.ComponentProps) {
    const { locations } = loaderData;
    const fetcher = useFetcher();

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);

    // Close modal only on explicit success; keep open on error so user sees the message
    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success === true) {
            setShowModal(false);
        }
    }, [fetcher.data, fetcher.state]);

    function openNew() { setForm(EMPTY_FORM); setEditId(null); setShowModal(true); }
    function openEdit(l: any) {
        setForm({
            name: l.name,
            address: l.address,
            city: l.city,
            country: l.country,
            phone: l.phone || "",
            mapsUrl: l.maps_url || "",
        });
        setEditId(l.id);
        setShowModal(true);
    }

    function save() {
        const fd = new FormData();
        fd.set("intent", editId ? "update" : "create");
        if (editId) fd.set("locationId", editId);
        fd.set("name", form.name);
        fd.set("address", form.address);
        fd.set("city", form.city);
        fd.set("country", form.country);
        fd.set("phone", form.phone);
        fd.set("mapsUrl", form.mapsUrl);
        fetcher.submit(fd, { method: "post" });
    }

    function toggle(id: string, currentActive: boolean) {
        const fd = new FormData();
        fd.set("intent", "toggle");
        fd.set("locationId", id);
        fd.set("isActive", String(!currentActive));
        fetcher.submit(fd, { method: "post" });
    }

    function remove(id: string) {
        const fd = new FormData();
        fd.set("intent", "delete");
        fd.set("locationId", id);
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Ubicaciones</h1>
                    <p className="text-white/50 text-sm mt-0.5">Gestiona las sedes físicas de tu estudio. Cada sede puede tener sus propias salas y horarios.</p>
                </div>
                <button onClick={openNew} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Nueva sede
                </button>
            </div>

            {locations.length === 0 ? (
                <div className="text-center py-20 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <MapPin className="w-12 h-12 text-white/30 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-white mb-2">Sin sedes registradas</h2>
                    <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">Agrega tu primera sede física para empezar a asignar salas y horarios.</p>
                    <button onClick={openNew} className="bg-amber-400 hover:bg-amber-500 text-black font-bold px-5 py-2.5 rounded-xl text-sm">+ Agregar sede</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {locations.map(l => (
                        <div key={l.id} className={`bg-white/5 rounded-2xl border p-5 space-y-4 transition-opacity ${l.is_active ? "border-white/[0.08]" : "border-white/5 opacity-60"}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                                        {FLAG[l.country] ?? "🏢"}
                                    </div>
                                    <div>
                                        <p className="font-black text-white">{l.name}</p>
                                        <p className="text-xs text-white/50">{l.city}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openEdit(l)} className="p-1.5 hover:bg-white/10 rounded-lg"><Pencil className="w-3.5 h-3.5 text-white/40" /></button>
                                    <button onClick={() => remove(l.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-sm text-white/60">
                                <p className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />{l.address}</p>
                                {l.phone && <p className="text-white/40 text-xs pl-5">{l.phone}</p>}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <button onClick={() => toggle(l.id, l.is_active)} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${l.is_active ? "bg-green-100 text-green-700" : "bg-white/10 text-white/50"}`}>
                                    {l.is_active ? "Activa" : "Inactiva"}
                                </button>
                                {l.maps_url && (
                                    <a href={l.maps_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-amber-600 hover:underline font-medium">
                                        <ExternalLink className="w-3 h-3" /> Ver en mapa
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-lg font-black text-white">{editId ? "Editar sede" : "Nueva sede"}</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre de la sede *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sede Principal — Polanco" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Dirección completa *</label>
                                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Av. Principal 123, Col. Centro" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Ciudad</label>
                                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Ciudad de México" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">País</label>
                                    <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm bg-white/5 focus:outline-none focus:border-amber-400">
                                        {Object.entries({ MX: "México", AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Perú" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Teléfono</label>
                                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+52 55 1234 5678" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Link de Google Maps (opcional)</label>
                                <input value={form.mapsUrl} onChange={e => setForm(f => ({ ...f, mapsUrl: e.target.value }))} placeholder="https://maps.google.com/..." className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
                            </div>
                        </div>
                        {fetcher.data?.error && (
                            <div className="px-6 pb-2">
                                <p className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 rounded-xl px-4 py-3">
                                    {fetcher.data.error}
                                </p>
                            </div>
                        )}
                        <div className="p-6 border-t border-white/5 flex gap-3">
                            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={save} disabled={!form.name || !form.address || fetcher.state !== "idle"} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">
                                {fetcher.state !== "idle" ? "Guardando…" : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
