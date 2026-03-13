// admin/reservas.tsx — Attendance management and waitlist for sessions
import { useState } from "react";
import { BookOpen, Check, X, Clock, Users } from "lucide-react";

interface Attendee {
    id: string;
    name: string;
    email: string;
    status: "confirmada" | "asistio" | "noshow" | "espera";
}
interface SessionReserva {
    id: string;
    className: string;
    coach: string;
    date: string;
    time: string;
    capacity: number;
    attendees: Attendee[];
}

const MOCK: SessionReserva[] = [
    {
        id: "r1", className: "Pilates Reformer", coach: "Valentina Cruz", date: "2025-05-12", time: "07:00", capacity: 8,
        attendees: [
            { id: "a1", name: "Ana Martínez", email: "ana.m@gmail.com", status: "confirmada" },
            { id: "a2", name: "Laura Torres", email: "laura.t@gmail.com", status: "confirmada" },
            { id: "a3", name: "María García", email: "maria.g@gmail.com", status: "asistio" },
            { id: "a4", name: "Roberto Silva", email: "rob.s@gmail.com", status: "noshow" },
            { id: "a5", name: "Diana López", email: "diana.l@gmail.com", status: "espera" },
        ],
    },
    {
        id: "r2", className: "Yoga Flow", coach: "Andrea Ríos", date: "2025-05-12", time: "09:00", capacity: 12,
        attendees: [
            { id: "a6", name: "Sofía Gutiérrez", email: "sofi.g@gmail.com", status: "confirmada" },
            { id: "a7", name: "Carlos Vega", email: "carlos.v@gmail.com", status: "asistio" },
        ],
    },
];

const STATUS_CFG: Record<Attendee["status"], { label: string; bg: string; text: string; icon: React.ReactNode }> = {
    confirmada: { label: "Confirmada", bg: "bg-blue-100", text: "text-blue-700", icon: <Clock className="w-3 h-3" /> },
    asistio: { label: "Asistió", bg: "bg-green-100", text: "text-green-700", icon: <Check className="w-3 h-3" /> },
    noshow: { label: "No asistió", bg: "bg-red-100", text: "text-red-700", icon: <X className="w-3 h-3" /> },
    espera: { label: "En espera", bg: "bg-amber-100", text: "text-amber-700", icon: <Users className="w-3 h-3" /> },
};

export default function Reservas() {
    const [sessions, setSessions] = useState<SessionReserva[]>(MOCK);
    const [selected, setSelected] = useState<string>(MOCK[0].id);

    const session = sessions.find(s => s.id === selected)!;

    function markStatus(attendeeId: string, status: Attendee["status"]) {
        setSessions(ss => ss.map(s => s.id === selected
            ? { ...s, attendees: s.attendees.map(a => a.id === attendeeId ? { ...a, status } : a) }
            : s
        ));
    }

    const confirmed = session.attendees.filter(a => a.status !== "espera").length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black text-white">Reservas</h1>
                <p className="text-white/50 text-sm mt-0.5">Control de asistencia y listas de espera por sesión.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Session selector */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Sesiones de hoy</p>
                    {sessions.map(s => {
                        const enrolled = s.attendees.filter(a => a.status !== "espera").length;
                        const isActive = s.id === selected;
                        return (
                            <button key={s.id} onClick={() => setSelected(s.id)} className={`w-full text-left p-4 rounded-xl border transition-all ${isActive ? "border-amber-400 bg-amber-50" : "border-white/[0.08] bg-white/5 hover:border-white/10"}`}>
                                <p className={`font-bold text-sm ${isActive ? "text-amber-800" : "text-white"}`}>{s.className}</p>
                                <p className="text-xs text-white/50 mt-0.5">{s.time} · {s.coach}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex-1 h-1.5 bg-white/5/10 rounded-full">
                                        <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${(enrolled / s.capacity) * 100}%` }} />
                                    </div>
                                    <span className="text-xs text-white/50">{enrolled}/{s.capacity}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Attendance list */}
                <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-2xl">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <div>
                            <h2 className="font-black text-white">{session.className}</h2>
                            <p className="text-sm text-white/50">{session.date} · {session.time} · {session.coach}</p>
                        </div>
                        <span className="text-sm font-bold text-white/50">{confirmed}/{session.capacity} lugares</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        {session.attendees.map(a => {
                            const cfg = STATUS_CFG[a.status];
                            return (
                                <div key={a.id} className="px-5 py-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-white text-sm">{a.name}</p>
                                        <p className="text-xs text-white/40">{a.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.bg} ${cfg.text}`}>
                                            {cfg.icon}{cfg.label}
                                        </span>
                                        {a.status === "confirmada" && (
                                            <div className="flex gap-1">
                                                <button onClick={() => markStatus(a.id, "asistio")} className="p-1.5 bg-green-100 hover:bg-green-200 rounded-lg transition-colors">
                                                    <Check className="w-3.5 h-3.5 text-green-700" />
                                                </button>
                                                <button onClick={() => markStatus(a.id, "noshow")} className="p-1.5 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
                                                    <X className="w-3.5 h-3.5 text-red-700" />
                                                </button>
                                            </div>
                                        )}
                                        {a.status === "espera" && (
                                            <button onClick={() => markStatus(a.id, "confirmada")} className="text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                                                Confirmar lugar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
