// admin/operaciones.tsx — Mi Estudio > Operaciones (rooms + class types)
import { useState } from "react";
import { Wrench, Plus, Pencil, Trash2 } from "lucide-react";

interface Room {
    id: string;
    name: string;
    location: string;
    capacity: number;
    equipment: string;
    active: boolean;
}

interface ClassType {
    id: string;
    name: string;
    color: string;
    duration: number;
    creditsRequired: number;
    description: string;
}

const MOCK_ROOMS: Room[] = [];

const MOCK_TYPES: ClassType[] = [];

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#6B7280", "#0EA5E9"];

export default function Operaciones() {
    const [rooms, setRooms] = useState<Room[]>(MOCK_ROOMS);
    const [types, setTypes] = useState<ClassType[]>(MOCK_TYPES);
    const [roomModal, setRoomModal] = useState(false);
    const [typeModal, setTypeModal] = useState(false);
    const [roomForm, setRoomForm] = useState({ name: "", location: "Sede Principal", capacity: 8, equipment: "" });
    const [typeForm, setTypeForm] = useState({ name: "", color: "#3B82F6", duration: 50, creditsRequired: 1, description: "" });

    function saveRoom() { setRooms(r => [...r, { id: `rm${Date.now()}`, ...roomForm, active: true }]); setRoomModal(false); }
    function saveType() { setTypes(t => [...t, { id: `ct${Date.now()}`, ...typeForm }]); setTypeModal(false); }
    const toggleRoom = (id: string) => setRooms(r => r.map(x => x.id === id ? { ...x, active: !x.active } : x));
    const removeRoom = (id: string) => setRooms(r => r.filter(x => x.id !== id));
    const removeType = (id: string) => setTypes(t => t.filter(x => x.id !== id));

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-black text-white">Operaciones</h1>
                <p className="text-white/50 text-sm mt-0.5">Configura las salas de tu estudio y los tipos de clases disponibles.</p>
            </div>

            {/* ─── SALAS ─── */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Salas</h2>
                    <button onClick={() => setRoomModal(true)} className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-black font-bold px-3.5 py-2 rounded-xl text-sm transition-all hover:scale-105 active:scale-95">
                        <Plus className="w-4 h-4" /> Nueva sala
                    </button>
                </div>

                {rooms.length === 0 ? (
                    <div className="text-center py-12 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                        <p className="text-white/40 text-sm">Sin salas. <button onClick={() => setRoomModal(true)} className="text-amber-600 font-semibold hover:underline">Agregar sala →</button></p>
                    </div>
                ) : (
                    <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>{["Sala", "Sede", "Cap.", "Equipamiento", "Estado", ""].map(h => <th key={h} className="text-left text-xs font-semibold text-white/50 uppercase tracking-wider px-4 py-3">{h}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {rooms.map(r => (
                                    <tr key={r.id} className={`hover:bg-white/5 ${!r.active ? "opacity-50" : ""}`}>
                                        <td className="px-4 py-3 font-bold text-white">{r.name}</td>
                                        <td className="px-4 py-3 text-white/50 text-xs">{r.location}</td>
                                        <td className="px-4 py-3 text-white/60">{r.capacity} personas</td>
                                        <td className="px-4 py-3 text-white/50 text-xs max-w-xs truncate">{r.equipment}</td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleRoom(r.id)} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${r.active ? "bg-green-100 text-green-700" : "bg-white/5/10 text-white/50"}`}>{r.active ? "Activa" : "Inactiva"}</button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => removeRoom(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
                    {types.map(t => (
                        <div key={t.id} className="bg-white/5 rounded-xl border border-white/[0.08] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                    <p className="font-bold text-white text-sm">{t.name}</p>
                                </div>
                                <button onClick={() => removeType(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed">{t.description}</p>
                            <div className="flex items-center gap-3 text-xs text-white/50">
                                <span className="bg-white/5/10 px-2 py-0.5 rounded-full">{t.duration} min</span>
                                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{t.creditsRequired} crédito{t.creditsRequired > 1 ? "s" : ""}</span>
                            </div>
                        </div>
                    ))}
                    <button onClick={() => setTypeModal(true)} className="bg-white/5 border-2 border-dashed border-white/[0.08] rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-amber-400 hover:bg-amber-50 transition-all group min-h-[120px]">
                        <Plus className="w-6 h-6 text-white/30 group-hover:text-amber-500" />
                        <span className="text-xs text-white/40 group-hover:text-amber-600 font-medium">Nuevo tipo de clase</span>
                    </button>
                </div>
            </div>

            {/* Room modal */}
            {roomModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b"><h2 className="text-lg font-black">Nueva sala</h2></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre *</label><input value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} placeholder="Sala A — Reformers" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Sede</label><input value={roomForm.location} onChange={e => setRoomForm(f => ({ ...f, location: e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Capacidad</label><input type="number" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Equipamiento</label><input value={roomForm.equipment} onChange={e => setRoomForm(f => ({ ...f, equipment: e.target.value }))} placeholder="Reformers, espejos, barras..." className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                        </div>
                        <div className="p-6 border-t flex gap-3">
                            <button onClick={() => setRoomModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={saveRoom} disabled={!roomForm.name} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Class type modal */}
            {typeModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b"><h2 className="text-lg font-black">Nuevo tipo de clase</h2></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Nombre *</label><input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="Pilates Reformer" className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            <div>
                                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Color de identificación</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setTypeForm(f => ({ ...f, color: c }))} className={`w-8 h-8 rounded-lg border-2 transition-all ${typeForm.color === c ? "border-gray-900 scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Duración (min)</label><input type="number" value={typeForm.duration} onChange={e => setTypeForm(f => ({ ...f, duration: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                                <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Créditos requeridos</label><input type="number" value={typeForm.creditsRequired} onChange={e => setTypeForm(f => ({ ...f, creditsRequired: +e.target.value }))} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" /></div>
                            </div>
                            <div><label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1">Descripción</label><textarea value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none" /></div>
                        </div>
                        <div className="p-6 border-t flex gap-3">
                            <button onClick={() => setTypeModal(false)} className="flex-1 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-medium text-white/60 hover:bg-white/5">Cancelar</button>
                            <button onClick={saveType} disabled={!typeForm.name} className="flex-1 bg-amber-400 hover:bg-amber-500 disabled:bg-white/5/20 disabled:text-white/40 text-black font-bold px-4 py-2.5 rounded-xl text-sm">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
