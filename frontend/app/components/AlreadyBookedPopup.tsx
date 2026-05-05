import { useEffect } from "react";
import { X, Ticket, Dumbbell, Clock } from "lucide-react";

export function AlreadyBookedPopup({
    classTitle,
    startTime,
    onClose,
}: {
    classTitle: string;
    startTime: string;
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const date = new Date(startTime);
    const dateStr = date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 pb-20 md:pb-0 pointer-events-none">
            <div
                className="pointer-events-auto w-full max-w-sm mx-4 bg-gray-900 border border-amber-500/30 rounded-2xl p-5 shadow-2xl animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Ticket className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Ya tienes una reserva activa</p>
                            <p className="text-xs text-white/50 mt-0.5">No se realizó un nuevo cargo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors ml-2">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-white/80">
                        <Dumbbell className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-sm font-medium">{classTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                        <Clock className="w-4 h-4 text-white/40 shrink-0" />
                        <span className="text-xs capitalize">{dateStr} · {timeStr}</span>
                    </div>
                </div>
                <p className="text-xs text-white/40 text-center mt-3">Tu lugar ya está reservado para esta clase.</p>
                <style>{`
                    @keyframes slideUp {
                        from { transform: translateY(100%); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    .animate-slide-up { animation: slideUp 0.3s ease-out; }
                `}</style>
            </div>
        </div>
    );
}
