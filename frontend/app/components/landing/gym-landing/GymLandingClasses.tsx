// app/components/landing/gym-landing/GymLandingClasses.tsx
import { Clock } from "lucide-react";
import type { GymLandingData } from "~/services/gym-lookup.server";

export function GymLandingClasses({ gym }: { gym: GymLandingData }) {
    if (gym.class_types.length === 0) return null;

    return (
        <section id="classes" className="py-24 px-6">
            <div className="mx-auto max-w-6xl">
                <div className="text-center mb-16">
                    <p
                        className="text-sm uppercase tracking-[0.2em] font-bold mb-4"
                        style={{ color: gym.primary_color }}
                    >
                        Nuestras disciplinas
                    </p>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Clases que <span className="text-white/40">ofrecemos</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gym.class_types.map((ct) => (
                        <div
                            key={ct.id}
                            className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
                        >
                            {/* Color accent bar */}
                            <div
                                className="w-10 h-1 rounded-full mb-4"
                                style={{ backgroundColor: ct.color || gym.primary_color }}
                            />

                            <h3 className="text-xl font-bold text-white mb-2">{ct.name}</h3>

                            {ct.description && (
                                <p className="text-white/50 text-sm leading-relaxed mb-4">
                                    {ct.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-white/40 text-xs font-medium">
                                <span className="flex items-center gap-1.5">
                                    <Clock className="size-3.5" />
                                    {ct.duration} min
                                </span>
                                {ct.credits_required > 0 && (
                                    <span>{ct.credits_required} crédito{ct.credits_required !== 1 ? "s" : ""}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
