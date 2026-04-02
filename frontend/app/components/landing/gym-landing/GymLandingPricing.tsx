// app/components/landing/gym-landing/GymLandingPricing.tsx
import { Check } from "lucide-react";
import type { GymLandingData } from "~/services/gym-lookup.server";

function formatPrice(price: number, currency: string): string {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(price);
}

export function GymLandingPricing({ gym }: { gym: GymLandingData }) {
    if (gym.plans.length === 0) return null;

    const currency = gym.currency || "MXN";

    return (
        <section id="pricing" className="py-24 px-6">
            <div className="mx-auto max-w-6xl">
                <div className="text-center mb-16">
                    <p
                        className="text-sm uppercase tracking-[0.2em] font-bold mb-4"
                        style={{ color: gym.primary_color }}
                    >
                        Planes
                    </p>
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Elige tu <span className="text-white/40">plan</span>
                    </h2>
                </div>

                <div className={`grid gap-6 ${
                    gym.plans.length === 1
                        ? "grid-cols-1 max-w-md mx-auto"
                        : gym.plans.length === 2
                        ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}>
                    {gym.plans.map((plan) => {
                        const isPopular = plan.metadata?.is_popular === true;
                        const features: string[] = plan.metadata?.features ?? [];

                        return (
                            <div
                                key={plan.id}
                                className={`relative bg-white/[0.03] rounded-2xl p-8 transition-all ${
                                    isPopular
                                        ? "border-2 shadow-lg"
                                        : "border border-white/10 hover:border-white/20"
                                }`}
                                style={isPopular ? { borderColor: gym.primary_color } : undefined}
                            >
                                {isPopular && (
                                    <div
                                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                                        style={{ backgroundColor: gym.primary_color }}
                                    >
                                        POPULAR
                                    </div>
                                )}

                                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                                {plan.description && (
                                    <p className="text-white/40 text-sm mt-1">{plan.description}</p>
                                )}

                                <div className="mt-6">
                                    <span className="text-4xl font-black text-white">
                                        {formatPrice(plan.price, currency)}
                                    </span>
                                    <span className="text-white/40 text-sm ml-1">/mes</span>
                                </div>

                                {features.length > 0 && (
                                    <ul className="mt-6 space-y-3">
                                        {features.map((f, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm text-white/60">
                                                <Check
                                                    className="size-4 shrink-0 mt-0.5"
                                                    style={{ color: gym.primary_color }}
                                                />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <a
                                    href="#cta"
                                    className={`mt-8 block text-center px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                                        isPopular
                                            ? "text-white hover:opacity-90"
                                            : "text-white border border-white/20 hover:border-white/40"
                                    }`}
                                    style={isPopular ? { backgroundColor: gym.primary_color } : undefined}
                                >
                                    Empezar ahora
                                </a>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
