// app/components/landing/gym-landing/GymLandingSchedule.tsx
import { Calendar, Clock, Users } from "lucide-react";
import type { GymLandingData } from "~/services/gym-lookup.server";

function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}

export function GymLandingSchedule({ gym }: { gym: GymLandingData }) {
    if (gym.upcoming_classes.length === 0) return null;

    return (
        <section id="schedule" className="py-24 px-6">
            <div className="mx-auto max-w-4xl">
                <div className="text-center mb-16">
                    <p
                        className="text-sm uppercase tracking-[0.2em] font-bold mb-4"
                        style={{ color: gym.primary_color }}
                    >
                        Próximas clases
                    </p>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Horario <span className="text-white/40">semanal</span>
                    </h2>
                </div>

                <div className="space-y-3">
                    {gym.upcoming_classes.map((cls) => {
                        const spotsLeft = cls.capacity - cls.current_enrolled;
                        const isFull = spotsLeft <= 0;

                        return (
                            <div
                                key={cls.id}
                                className="flex items-center gap-4 bg-white/[0.03] border border-white/10 rounded-xl px-5 py-4 hover:border-white/20 transition-all"
                            >
                                {/* Date */}
                                <div className="hidden sm:flex flex-col items-center min-w-[70px] text-center">
                                    <span className="text-white/40 text-xs font-bold uppercase">
                                        {formatDate(cls.start_time)}
                                    </span>
                                </div>

                                {/* Time */}
                                <div className="flex items-center gap-1.5 text-white/60 min-w-[100px]">
                                    <Clock className="size-3.5 shrink-0" />
                                    <span className="text-sm font-medium">
                                        {formatTime(cls.start_time)} – {formatTime(cls.end_time)}
                                    </span>
                                </div>

                                {/* Title + Coach */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold text-sm truncate">{cls.title}</p>
                                    <p className="text-white/40 text-xs">{cls.coach_name}</p>
                                </div>

                                {/* Spots */}
                                <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
                                    <Users className="size-3.5" />
                                    {isFull ? (
                                        <span className="text-red-400">Lleno</span>
                                    ) : (
                                        <span className="text-white/50">
                                            {spotsLeft} lugar{spotsLeft !== 1 ? "es" : ""}
                                        </span>
                                    )}
                                </div>

                                {/* CTA */}
                                <a
                                    href="#cta"
                                    className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        isFull
                                            ? "bg-white/5 text-white/30 cursor-not-allowed"
                                            : "text-white hover:opacity-90"
                                    }`}
                                    style={!isFull ? { backgroundColor: gym.primary_color } : undefined}
                                >
                                    {isFull ? "Waitlist" : "Reservar"}
                                </a>
                            </div>
                        );
                    })}
                </div>

                <p className="text-center mt-8 text-white/30 text-sm">
                    Crea tu cuenta para ver el horario completo y reservar tu lugar.
                </p>
            </div>
        </section>
    );
}
