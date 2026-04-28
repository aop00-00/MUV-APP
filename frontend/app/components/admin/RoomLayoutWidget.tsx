import { useState, useEffect } from "react";
import { PlusCircle, MapPin, Trash2, Edit3, ArrowRight, User, ChevronLeft, ChevronRight, X, Save, Plus } from "lucide-react";
import { Link, useFetcher } from "react-router";
import { EditableSeatMap, ReadOnlySeatMap, type LayoutGrid, type SeatResource } from "~/components/SeatMap";
import type { GymRoom } from "~/services/room.server";

interface RoomLayoutWidgetProps {
    gym: {
        primary_color: string;
        brand_color: string;
        studio_type: string;
        booking_mode: string;
    } | null;
    rooms: GymRoom[];
    nextClass: any | null;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getConfig(studioType?: string | null) {
    const map: Record<string, { label: string; emoji: string; resourceType: string }> = {
        cycling: { label: "Bicicleta", emoji: "🚲", resourceType: "bike" },
        pilates: { label: "Reformer",  emoji: "🛏️", resourceType: "reformer" },
        barre:   { label: "Barra",     emoji: "⚡",  resourceType: "barre" },
        yoga:    { label: "Mat",       emoji: "🧘", resourceType: "mat" },
    };
    return map[studioType ?? ""] ?? { label: "Lugar", emoji: "⚡", resourceType: "spot" };
}

function gridToResources(grid: LayoutGrid, studioType?: string | null) {
    const cfg = getConfig(studioType);
    return Object.entries(grid)
        .filter(([, c]) => c.active)
        .map(([key, c]) => {
            const [row, col] = key.split(",").map(Number);
            return { row, col, name: c.name, resourceType: cfg.resourceType };
        });
}

function stripRoomSuffix(name: string) {
    return name.replace(/__[a-f0-9]{6}$/i, "");
}

function roomToGrid(room: GymRoom & { resources?: SeatResource[] }): { grid: LayoutGrid; rows: number; cols: number } {
    const lc = (room as any).layout_config as { rows?: number; cols?: number } | null;
    const rows = lc?.rows ?? 4;
    const cols = lc?.cols ?? 5;
    const grid: LayoutGrid = {};
    const resources: SeatResource[] = (room as any).resources ?? [];
    for (const r of resources) {
        grid[`${r.position_row},${r.position_col}`] = { active: true, name: stripRoomSuffix(r.name) };
    }
    return { grid, rows, cols };
}

// ── sub-components ────────────────────────────────────────────────────────────

function CreateRoomModal({ onClose }: { onClose: () => void }) {
    const fetcher = useFetcher();
    const [name, setName] = useState("");
    const [capacity, setCapacity] = useState(10);

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            if (fetcher.data.error) {
                alert(`Error: ${fetcher.data.error}`);
            } else if (fetcher.data.success && fetcher.data.intent === "create_room") {
                onClose();
            }
        }
    }, [fetcher.state, fetcher.data]);

    function submit() {
        const fd = new FormData();
        fd.set("intent", "create_room");
        fd.set("name", name);
        fd.set("capacity", String(capacity));
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Nueva Sala</h3>
                    <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Nombre de la sala *</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Sala Principal, Sala 2…"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">Capacidad máxima</label>
                        <input
                            type="number"
                            min={1}
                            max={500}
                            value={capacity}
                            onChange={e => setCapacity(+e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div className="p-5 border-t border-white/[0.08] flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-medium text-white/50 hover:bg-white/5 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={submit}
                        disabled={!name.trim() || fetcher.state !== "idle"}
                        className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all"
                    >
                        {fetcher.state !== "idle" ? "Creando…" : "Crear Sala"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function LayoutEditor({
    room,
    studioType,
    brandColor,
    onClose,
}: {
    room: GymRoom;
    studioType?: string | null;
    brandColor: string;
    onClose: () => void;
}) {
    const fetcher = useFetcher();
    const initial = roomToGrid(room);
    const [grid, setGrid] = useState<LayoutGrid>(initial.grid);
    const [rows, setRows] = useState(initial.rows);
    const [cols, setCols] = useState(initial.cols);

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            if (fetcher.data.error) {
                alert(`Error: ${fetcher.data.error}`);
            } else if (fetcher.data.success && fetcher.data.intent === "save_room_layout") {
                onClose();
            }
        }
    }, [fetcher.state, fetcher.data]);

    function save() {
        const resources = gridToResources(grid, studioType);
        const fd = new FormData();
        fd.set("intent", "save_room_layout");
        fd.set("roomId", room.id);
        fd.set("layoutConfig", JSON.stringify({ rows, cols }));
        fd.set("resources", JSON.stringify(resources));
        fetcher.submit(fd, { method: "post" });
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Editar Layout — {room.name}</h3>
                        <p className="text-[10px] text-white/40 mt-0.5">Haz clic para activar/desactivar. Doble clic para renombrar.</p>
                    </div>
                    <button onClick={onClose} className="text-white/30 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-white rounded-xl m-4">
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
                <div className="p-5 border-t border-white/[0.08] flex gap-3 shrink-0">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl text-sm font-medium text-white/50 hover:bg-white/5 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={save}
                        disabled={fetcher.state !== "idle"}
                        className="flex-1 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all"
                    >
                        <Save className="w-4 h-4" />
                        {fetcher.state !== "idle" ? "Guardando…" : "Guardar Layout"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export function RoomLayoutWidget({ gym, rooms, nextClass }: RoomLayoutWidgetProps) {
    const brandColor = gym?.brand_color || gym?.primary_color || "#7c3aed";
    const studioType = gym?.studio_type ?? null;
    const fetcher = useFetcher();

    const [currentIdx, setCurrentIdx] = useState(0);
    const [showLayoutEditor, setShowLayoutEditor] = useState(false);
    const [showCreateRoom, setShowCreateRoom] = useState(false);

    // keep idx in bounds if rooms change
    const safeIdx = Math.min(currentIdx, Math.max(0, rooms.length - 1));
    const currentRoom = rooms[safeIdx] ?? null;

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data?.success && fetcher.data?.intent === "create_room") {
            // Re-point to the last available room (newly created)
            setCurrentIdx(Math.max(0, rooms.length - 1));
        }
    }, [fetcher.state, fetcher.data, rooms.length]);

    function prevRoom() { setCurrentIdx(i => Math.max(0, i - 1)); }
    function nextRoom() { setCurrentIdx(i => Math.min(rooms.length - 1, i + 1)); }

    function deleteRoom(id: string) {
        if (!confirm("¿Eliminar esta sala? Se borrarán también sus recursos y layout.")) return;
        const fd = new FormData();
        fd.set("intent", "delete_room");
        fd.set("roomId", id);
        fetcher.submit(fd, { method: "post" });
    }

    // Build seat resources from room's layout_config / resources
    const resources: SeatResource[] = (() => {
        if (!currentRoom) return [];
        const raw = (currentRoom as any).resources as SeatResource[] | undefined;
        if (raw && raw.length > 0) return raw;
        // Fallback: try layout_config.resources (legacy)
        const lc = (currentRoom as any).layout_config as { resources?: any[] } | null;
        if (!lc?.resources) return [];
        return lc.resources.map((r: any) => ({
            id: r.id || r.name,
            name: r.name,
            resource_type: r.type ?? r.resource_type,
            position_row: r.row ?? r.position_row,
            position_col: r.col ?? r.position_col,
            is_active: true,
        }));
    })();

    return (
        <>
            <div className="bg-white/[0.03] backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden w-full mb-6">
                {/* ── HEADER ── */}
                <div className="p-4 md:p-6 border-b border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
                            <MapPin className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                                Mapa en Vivo
                            </h2>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">
                                Gestión visual de asientos y recursos
                            </p>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0 w-full md:w-auto">
                        <Link
                            to="/admin/horarios"
                            className="flex-1 md:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-all"
                        >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Crear Clase
                        </Link>

                        <button
                            type="button"
                            onClick={() => currentRoom && setShowLayoutEditor(true)}
                            disabled={!currentRoom}
                            className="flex-1 md:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            Modificar Layout
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowCreateRoom(true)}
                            className="flex-1 md:flex-none flex justify-center items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Nueva Sala
                        </button>
                    </div>
                </div>

                {/* ── ROOM CAROUSEL INDICATOR ── */}
                {rooms.length > 0 && (
                    <div className="px-4 md:px-6 py-3 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={prevRoom}
                                disabled={safeIdx === 0}
                                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {/* Dots */}
                            <div className="flex items-center gap-1.5">
                                {rooms.map((r, i) => (
                                    <button
                                        key={r.id}
                                        onClick={() => setCurrentIdx(i)}
                                        title={r.name}
                                        className={`rounded-full transition-all ${i === safeIdx ? "w-5 h-2 bg-indigo-400" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={nextRoom}
                                disabled={safeIdx === rooms.length - 1}
                                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed text-white transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Room name + delete */}
                        <div className="flex items-center gap-3">
                            <div className="text-center">
                                <p className="text-xs font-black text-white">{currentRoom?.name}</p>
                                <p className="text-[10px] text-white/30">Cap. {currentRoom?.capacity} personas</p>
                            </div>
                            {currentRoom && (
                                <button
                                    onClick={() => deleteRoom(currentRoom.id)}
                                    className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400/50 hover:text-red-400 transition-all"
                                    title="Eliminar sala"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── BODY ── */}
                {rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="p-4 bg-white/5 rounded-2xl mb-4">
                            <MapPin className="w-8 h-8 text-white/20" />
                        </div>
                        <h3 className="text-white font-black text-lg mb-2">Sin salas configuradas</h3>
                        <p className="text-white/40 text-sm max-w-xs mb-6">Crea tu primera sala para gestionar el layout visual y asignar recursos.</p>
                        <button
                            onClick={() => setShowCreateRoom(true)}
                            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
                        >
                            <Plus className="w-4 h-4" /> Crear Primera Sala
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row w-full">
                        {/* LEFT: next class info */}
                        <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/[0.08] p-6 flex flex-col justify-between bg-white/[0.01]">
                            <div>
                                <h3 className="text-[10px] bg-white/10 inline-block px-2 py-1 rounded-full text-white/70 font-black uppercase tracking-widest mb-4">
                                    Próxima Sesión Programada
                                </h3>

                                {nextClass ? (
                                    <div className="space-y-4">
                                        <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                                            <div className="text-[10px] text-indigo-400 font-bold uppercase mb-1">
                                                {new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" }).format(new Date(nextClass.start_time))}
                                            </div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="text-2xl font-black text-white leading-none">{nextClass.title}</h4>
                                                {nextClass.isEvent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold uppercase tracking-widest border border-violet-500/30">Evento</span>}
                                            </div>
                                            <div className="flex flex-col gap-2 mt-4 text-xs font-bold text-white/60">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 rounded-md bg-white/10"><User className="w-3 h-3" /></div>
                                                    Coach: <span className="text-white">{nextClass.coach_name || nextClass.coach?.name || "Staff"}</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                                    <div className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-lg">{nextClass.current_enrolled} Inscritos</div>
                                                    <div className="px-2.5 py-1 bg-white/10 rounded-lg">{nextClass.capacity - (nextClass.current_enrolled || 0)} Disponibles</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link
                                                to="/admin/schedule"
                                                className="flex-1 flex justify-center items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-lg transition-all group"
                                            >
                                                Ver detalles <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                                            </Link>
                                            <fetcher.Form method="post" action="/admin/schedule" onSubmit={e => { if (!confirm("¿Eliminar esta clase?")) e.preventDefault(); }}>
                                                <input type="hidden" name="intent" value="delete_class" />
                                                <input type="hidden" name="classId" value={nextClass.id} />
                                                <button type="submit" className="p-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all" title="Eliminar clase">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </fetcher.Form>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-white/10 rounded-xl bg-white/5 h-48">
                                        <p className="text-white/40 text-sm font-bold italic mb-2">No hay clases próximas en agenda.</p>
                                        <Link to="/admin/horarios" className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase underline">Crear una clase</Link>
                                    </div>
                                )}
                            </div>
                            <p className="mt-8 text-[10px] text-white/20 uppercase leading-relaxed tracking-wider">
                                El mapa refleja la distribución configurada. Usa las flechas para navegar entre salas.
                            </p>
                        </div>

                        {/* RIGHT: seat map */}
                        <div className="w-full lg:w-2/3 p-4 md:p-8 flex items-center justify-center overflow-x-auto overflow-y-auto bg-black/20">
                            {resources.length > 0 ? (
                                <div className="transform scale-75 md:scale-90 lg:scale-100 origin-center">
                                    <ReadOnlySeatMap
                                        resources={resources}
                                        bookedIds={[]}
                                        selectedId={null}
                                        onSelect={() => {}}
                                        brandColor={brandColor}
                                        studioType={studioType}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <p className="text-white/30 text-sm font-bold uppercase tracking-widest">Sin layout configurado para esta sala.</p>
                                    <button
                                        onClick={() => setShowLayoutEditor(true)}
                                        className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-xs font-bold border border-indigo-500/30 px-4 py-2 rounded-lg transition-all"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" /> Configurar Layout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showLayoutEditor && currentRoom && (
                <LayoutEditor
                    room={currentRoom}
                    studioType={studioType}
                    brandColor={brandColor}
                    onClose={() => setShowLayoutEditor(false)}
                />
            )}
            {showCreateRoom && (
                <CreateRoomModal onClose={() => setShowCreateRoom(false)} />
            )}
        </>
    );
}
