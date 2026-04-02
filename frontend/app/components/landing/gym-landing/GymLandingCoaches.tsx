// app/components/landing/gym-landing/GymLandingCoaches.tsx
import type { GymLandingData } from "~/services/gym-lookup.server";

export function GymLandingCoaches({ gym }: { gym: GymLandingData }) {
    if (gym.coaches.length === 0) return null;

    return (
        <section id="coaches" className="py-24 px-6">
            <div className="mx-auto max-w-6xl">
                <div className="text-center mb-16">
                    <p
                        className="text-sm uppercase tracking-[0.2em] font-bold mb-4"
                        style={{ color: gym.primary_color }}
                    >
                        Equipo
                    </p>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Nuestros <span className="text-white/40">coaches</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gym.coaches.map((coach) => (
                        <div
                            key={coach.id}
                            className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center hover:border-white/20 transition-all"
                        >
                            {/* Avatar placeholder */}
                            <div
                                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white"
                                style={{ backgroundColor: gym.primary_color + "30" }}
                            >
                                {coach.name.charAt(0).toUpperCase()}
                            </div>

                            <h3 className="text-lg font-bold text-white">{coach.name}</h3>

                            {coach.specialties && coach.specialties.length > 0 && (
                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                    {coach.specialties.map((s) => (
                                        <span
                                            key={s}
                                            className="text-xs font-medium px-3 py-1 rounded-full border border-white/10 text-white/50"
                                        >
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
