// app/components/SeatMap.tsx
// Visual seat/equipment map for booking — disciplines like cycling (bikes) and pilates (reformers).
// Used by both admin (layout editor) and user (seat selection during booking).

import { useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export type StudioType = "cycling" | "pilates" | "barre" | "yoga" | "hiit" | "martial" | "dance";

export interface SeatResource {
    id: string;
    name: string;
    resource_type: string;
    position_row: number;
    position_col: number;
    is_active: boolean;
}

// ─── Discipline SVG Icons ───────────────────────────────────────────────────
// Custom SVG icons that accurately represent each studio discipline.

function IconCycling({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5.5" cy="17.5" r="3.5" />
            <circle cx="18.5" cy="17.5" r="3.5" />
            <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 10l3-2 2 4h4" />
            <path d="m5.5 17.5 3-7 2-1" />
        </svg>
    );
}

function IconPilates({ size = 20 }: { size?: number }) {
    // Represents a reformer machine: a horizontal platform with pulleys
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {/* Reformer bed/carriage */}
            <rect x="2" y="10" width="20" height="5" rx="1.5" />
            {/* Headrest */}
            <rect x="3" y="8" width="5" height="2" rx="1" />
            {/* Foot bar */}
            <line x1="18" y1="8" x2="18" y2="10" />
            <line x1="20" y1="8" x2="20" y2="10" />
            <line x1="18" y1="8" x2="20" y2="8" />
            {/* Legs */}
            <line x1="4" y1="15" x2="4" y2="18" />
            <line x1="20" y1="15" x2="20" y2="18" />
            {/* Springs/ropes */}
            <line x1="14" y1="12" x2="22" y2="12" strokeDasharray="1.5 1" />
        </svg>
    );
}

function IconYoga({ size = 20 }: { size?: number }) {
    // Yoga mat with lotus-like pose suggestion
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {/* Mat */}
            <ellipse cx="12" cy="19" rx="9" ry="2" />
            {/* Person in tree/lotus pose */}
            <circle cx="12" cy="6" r="2" />
            {/* Arms raised */}
            <path d="M9 11c1-1 2-1.5 3-1.5s2 .5 3 1.5" />
            <line x1="7" y1="10" x2="9" y2="11" />
            <line x1="17" y1="10" x2="15" y2="11" />
            {/* Body */}
            <line x1="12" y1="9.5" x2="12" y2="16" />
            {/* Crossed legs */}
            <path d="M12 16 Q9 18 8 19" />
            <path d="M12 16 Q15 18 16 19" />
        </svg>
    );
}

function IconBarre({ size = 20 }: { size?: number }) {
    // Ballet barre: horizontal bar with vertical supports + leg extension
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {/* Horizontal barre */}
            <line x1="2" y1="10" x2="22" y2="10" />
            {/* Vertical supports */}
            <line x1="4" y1="10" x2="4" y2="20" />
            <line x1="20" y1="10" x2="20" y2="20" />
            {/* Person doing arabesque */}
            <circle cx="13" cy="5" r="2" />
            {/* Body leaning on barre */}
            <line x1="13" y1="7" x2="11" y2="10" />
            {/* Leg extended back */}
            <line x1="11" y1="10" x2="8" y2="13" />
            <line x1="11" y1="10" x2="16" y2="8" />
            {/* Arm on barre */}
            <line x1="13" y1="8" x2="17" y2="10" />
        </svg>
    );
}

function IconHiit({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    );
}

function IconMat({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="10" rx="2" />
            <line x1="7" y1="8" x2="7" y2="18" strokeOpacity="0.4" />
            <line x1="12" y1="8" x2="12" y2="18" strokeOpacity="0.4" />
            <line x1="17" y1="8" x2="17" y2="18" strokeOpacity="0.4" />
        </svg>
    );
}

// ─── Discipline config ──────────────────────────────────────────────────────

type DisciplineConfig = {
    label: string;
    resourceType: string;
    Icon: React.ComponentType<{ size?: number }>;
};

const DISCIPLINE_CONFIG: Record<string, DisciplineConfig> = {
    cycling: { label: "Bicicleta", resourceType: "bike",     Icon: IconCycling },
    pilates: { label: "Reformer",  resourceType: "reformer", Icon: IconPilates },
    barre:   { label: "Barra",     resourceType: "barre",    Icon: IconBarre   },
    yoga:    { label: "Mat",       resourceType: "mat",      Icon: IconYoga    },
    hiit:    { label: "Lugar",     resourceType: "spot",     Icon: IconHiit    },
    dance:   { label: "Lugar",     resourceType: "spot",     Icon: IconMat     },
    martial: { label: "Lugar",     resourceType: "spot",     Icon: IconMat     },
};

function getConfig(studioType?: string | null): DisciplineConfig {
    return DISCIPLINE_CONFIG[studioType ?? ""] ?? { label: "Lugar", resourceType: "spot", Icon: IconMat };
}

// ─── READ-ONLY Seat Map (user booking) ─────────────────────────────────────
// Shows which seats are available/booked and lets user pick one.

interface ReadOnlySeatMapProps {
    resources: SeatResource[];
    bookedIds: string[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    brandColor: string;
    studioType?: string | null;
}

function displayName(raw: string) {
    return raw.replace(/__[a-f0-9]{6}$/i, "");
}

export function ReadOnlySeatMap({
    resources,
    bookedIds,
    selectedId,
    onSelect,
    brandColor,
    studioType,
}: ReadOnlySeatMapProps) {
    const config = getConfig(studioType);
    const active = resources.filter(r => r.is_active);

    if (active.length === 0) return null;

    const maxRow = Math.max(...active.map(r => r.position_row));
    const maxCol = Math.max(...active.map(r => r.position_col));

    // Build a lookup map for quick access
    const byPos = new Map<string, SeatResource>();
    for (const r of active) byPos.set(`${r.position_row},${r.position_col}`, r);

    // Seat size: 36px on mobile, 40px on larger screens (via CSS var)
    const cols = maxCol + 1;

    return (
        <div className="space-y-3">
            {/* Legend — wrap on tiny screens */}
            <div className="flex flex-wrap items-center justify-between gap-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Selecciona tu {config.label}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium flex-wrap">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded border-2 inline-block shrink-0" style={{ borderColor: brandColor, backgroundColor: `${brandColor}20` }} /> Disponible
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300 inline-block shrink-0" /> Ocupado
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded inline-block shrink-0" style={{ backgroundColor: brandColor }} /> Tu lugar
                    </span>
                </div>
            </div>

            {/* Instructor bar */}
            <div className="w-full flex justify-center">
                <div className="bg-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-1 rounded-lg">
                    FRENTE / INSTRUCTOR
                </div>
            </div>

            {/* Scrollable wrapper — prevents overflow on narrow screens */}
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
                <div
                    className="grid gap-1.5 mx-auto"
                    style={{
                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                        width: `${cols * 44}px`,
                        maxWidth: "100%",
                    }}
                >
                    {Array.from({ length: maxRow + 1 }).map((_, row) =>
                        Array.from({ length: cols }).map((_, col) => {
                            const seat = byPos.get(`${row},${col}`);
                            if (!seat) {
                                return <div key={`${row}-${col}`} style={{ width: 40, height: 40 }} />;
                            }

                            const isBooked = bookedIds.includes(seat.id);
                            const isSelected = seat.id === selectedId;
                            const seatLabel = displayName(seat.name);

                            return (
                                <button
                                    key={seat.id}
                                    disabled={isBooked}
                                    onClick={() => onSelect(seat.id)}
                                    aria-label={seatLabel}
                                    className={`
                                        rounded-lg flex flex-col items-center justify-center
                                        border-2 transition-all duration-150 touch-manipulation
                                        min-w-[40px] min-h-[44px]
                                        ${isBooked
                                            ? "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
                                            : isSelected
                                                ? "scale-105 shadow-lg cursor-pointer text-white"
                                                : "cursor-pointer active:scale-95"
                                        }
                                    `}
                                    style={
                                        isSelected
                                            ? { backgroundColor: brandColor, borderColor: brandColor }
                                            : !isBooked
                                                ? { borderColor: brandColor, backgroundColor: `${brandColor}15`, color: brandColor }
                                                : {}
                                    }
                                >
                                    <config.Icon size={16} />
                                    <span className="text-[7px] font-bold leading-none mt-0.5 opacity-70">
                                        {seatLabel.replace(/\D/g, "")}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {selectedId && (
                <p className="text-center text-xs font-medium text-gray-600">
                    Seleccionaste: <strong>{displayName(active.find(r => r.id === selectedId)?.name ?? "")}</strong>
                </p>
            )}
        </div>
    );
}

// ─── EDITABLE Seat Map (admin layout builder) ───────────────────────────────
// Admin clicks cells to place/remove seats. Double-click to rename.

export interface EditableCell {
    active: boolean;
    name: string;
}

export type LayoutGrid = Record<string, EditableCell>; // key = "row,col"

interface EditableSeatMapProps {
    rows: number;
    cols: number;
    grid: LayoutGrid;
    onChange: (grid: LayoutGrid) => void;
    brandColor: string;
    studioType?: string | null;
    onRowsChange: (rows: number) => void;
    onColsChange: (cols: number) => void;
}

export function EditableSeatMap({
    rows,
    cols,
    grid,
    onChange,
    brandColor,
    studioType,
    onRowsChange,
    onColsChange,
}: EditableSeatMapProps) {
    const config = getConfig(studioType);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    // Auto-number active cells
    function getActiveCells(g: LayoutGrid) {
        return Object.entries(g)
            .filter(([, c]) => c.active)
            .sort(([a], [b]) => {
                const [ar, ac] = a.split(",").map(Number);
                const [br, bc] = b.split(",").map(Number);
                return ar !== br ? ar - br : ac - bc;
            });
    }

    function buildAutoNames(g: LayoutGrid): LayoutGrid {
        const next = { ...g };
        const active = getActiveCells(next);
        active.forEach(([key], i) => {
            const cur = next[key].name;
            // Auto-name if empty or matches any label pattern (any language) followed by a number
            const isDefault = !cur || /^.+ \d+$/.test(cur);
            if (isDefault) {
                next[key] = { ...next[key], name: `${config.label} ${i + 1}` };
            }
        });
        return next;
    }

    function toggleCell(row: number, col: number) {
        const key = `${row},${col}`;
        const cell = grid[key];
        const next = {
            ...grid,
            [key]: { active: !(cell?.active), name: cell?.name || "" },
        };
        onChange(buildAutoNames(next));
    }

    function startEdit(key: string) {
        setEditingKey(key);
        setEditValue(grid[key]?.name || "");
    }

    function commitEdit() {
        if (!editingKey) return;
        onChange({ ...grid, [editingKey]: { ...grid[editingKey], name: editValue } });
        setEditingKey(null);
    }

    const activeCounts = getActiveCells(grid).length;

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-4 text-xs text-gray-600">
                <label className="flex items-center gap-1.5">
                    Filas:
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={rows}
                        onChange={e => onRowsChange(Math.max(1, Math.min(10, +e.target.value)))}
                        className="w-12 px-1.5 py-1 border border-gray-200 rounded-lg text-center focus:outline-none focus:border-violet-400"
                    />
                </label>
                <label className="flex items-center gap-1.5">
                    Columnas:
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={cols}
                        onChange={e => onColsChange(Math.max(1, Math.min(10, +e.target.value)))}
                        className="w-12 px-1.5 py-1 border border-gray-200 rounded-lg text-center focus:outline-none focus:border-violet-400"
                    />
                </label>
                <span className="ml-auto text-gray-400 font-medium">
                    {activeCounts} {config.label}{activeCounts !== 1 ? "s" : ""} colocad{activeCounts !== 1 ? "os" : "o"}
                </span>
            </div>

            {/* Instructions */}
            <p className="text-[11px] text-gray-400">
                Haz clic para activar/desactivar una posición. Doble clic para cambiar nombre.
            </p>

            {/* Frente */}
            <div className="flex justify-center">
                <div className="bg-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-widest px-8 py-1.5 rounded-lg">
                    FRENTE / INSTRUCTOR
                </div>
            </div>

            {/* Grid */}
            <div
                className="grid gap-2 mx-auto"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    maxWidth: `${cols * 56}px`,
                }}
            >
                {Array.from({ length: rows }).map((_, row) =>
                    Array.from({ length: cols }).map((_, col) => {
                        const key = `${row},${col}`;
                        const cell = grid[key];
                        const isActive = cell?.active ?? false;
                        const isEditing = editingKey === key;

                        return (
                            <div key={key} className="relative">
                                {isEditing ? (
                                    <input
                                        autoFocus
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        onBlur={commitEdit}
                                        onKeyDown={e => e.key === "Enter" && commitEdit()}
                                        className="w-10 h-10 text-center text-[9px] font-bold border-2 rounded-lg focus:outline-none"
                                        style={{ borderColor: brandColor }}
                                    />
                                ) : (
                                    <button
                                        onClick={() => toggleCell(row, col)}
                                        onDoubleClick={() => isActive && startEdit(key)}
                                        title={isActive ? `${cell?.name} — doble clic para renombrar` : "Clic para activar"}
                                        className={`
                                            w-10 h-10 rounded-lg flex flex-col items-center justify-center
                                            border-2 transition-all duration-150 select-none
                                            ${isActive
                                                ? "hover:scale-105 active:scale-95"
                                                : "border-dashed border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                                            }
                                        `}
                                        style={
                                            isActive
                                                ? { borderColor: brandColor, backgroundColor: `${brandColor}20`, color: brandColor }
                                                : {}
                                        }
                                    >
                                        {isActive ? (
                                            <>
                                                <config.Icon size={16} />
                                                <span className="text-[7px] font-bold leading-none mt-0.5 opacity-60">
                                                    {(cell?.name || "").replace(/\D/g, "")}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-gray-300 text-lg">+</span>
                                        )}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
