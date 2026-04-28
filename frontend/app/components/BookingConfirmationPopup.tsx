// app/components/BookingConfirmationPopup.tsx
import { Check, Calendar, Clock, CreditCard, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BookingConfirmationPopupProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
    classTitle: string;
    startTime: string;
    creditsRemaining: number | null;
    planType?: "creditos" | "membresia" | "ilimitado";
}

export function BookingConfirmationPopup({
    isOpen,
    onClose,
    classTitle,
    startTime,
    creditsRemaining,
    planType = "creditos",
}: BookingConfirmationPopupProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            // Auto-close after 5 seconds
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            setTimeout(() => setIsVisible(false), 300);
        }
    }, [isOpen, onClose]);

    if (!isVisible && !isOpen) return null;

    const startDate = new Date(startTime);
    const dateStr = startDate.toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
    const timeStr = startDate.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${
                isOpen ? "opacity-100" : "opacity-0"
            }`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Content Card */}
            <div
                className={`relative w-full max-w-sm bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 transition-all duration-500 transform ${
                    isOpen ? "scale-100 translate-y-0" : "scale-90 translate-y-10"
                }`}
            >
                {/* Decorative Background Orbs */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-lime-400/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl" />

                <div className="relative p-8 flex flex-col items-center text-center">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Success Icon Animation */}
                    <div className="mb-6 relative">
                        <div className="w-20 h-20 bg-lime-400/20 rounded-full flex items-center justify-center animate-bounce-subtle">
                            <div className="w-14 h-14 bg-gradient-to-br from-lime-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-lime-400/50">
                                <Check className="w-8 h-8 text-slate-900 stroke-[4px]" />
                            </div>
                        </div>
                        {/* Particles/Sparkles */}
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-lime-400 rounded-full animate-ping" style={{ animationDelay: "0.1s" }} />
                             <div className="absolute bottom-0 left-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: "0.3s" }} />
                             <div className="absolute top-1/2 right-0 w-1 h-1 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: "0.5s" }} />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Class Booked!</h2>
                    <p className="text-white/60 text-sm mb-8">Your spot is secured. See you soon!</p>

                    {/* Class Details Card */}
                    <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 space-y-3 backdrop-blur-sm">
                        <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Class</p>
                                <p className="text-sm font-semibold text-white truncate">{classTitle}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Schedule</p>
                                <p className="text-sm font-semibold text-white">{dateStr} • {timeStr}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-left">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${planType === "creditos" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                                <CreditCard className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                {planType === "creditos" ? (
                                    <>
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Créditos restantes</p>
                                        <p className="text-sm font-semibold text-white">{creditsRemaining ?? 0} créditos</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Acceso</p>
                                        <p className="text-sm font-semibold text-emerald-400">
                                            {planType === "ilimitado" ? "Ilimitado ∞" : "Membresía activa ✓"}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-lime-400 hover:bg-lime-500 text-slate-900 rounded-2xl font-bold shadow-xl shadow-lime-400/20 transition-all active:scale-95"
                    >
                        Got it
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .animate-bounce-subtle {
                    animation: bounce-subtle 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
