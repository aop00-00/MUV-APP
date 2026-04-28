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

// ─── Discipline config ──────────────────────────────────────────────────────

const DISCIPLINE_CONFIG: Record<string, { label: string; emoji: string; resourceType: string }> = {
    cycling: { label: "Bicicleta", emoji: "🚲", resourceType: "bike" },
    pilates: { label: "Reformer", emoji: "🛏️", resourceType: "reformer" },
    barre:   { label: "Barra",     emoji: "⚡", resourceType: "barre" },
    yoga:    { label: "Mat",       emoji: "🧘", resourceType: "mat" },
};

function getConfig(studioType?: string | null) {
    return DISCIPLINE_CONFIG[studioType ?? ""] ?? { label: "Lugar", emoji: "⚡", resourceType: "spot" };
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
                                    <span className="text-base leading-none">{config.emoji}</span>
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
                                                <span className="text-base leading-none">{config.emoji}</span>
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
