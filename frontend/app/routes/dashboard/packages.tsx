// Auth service moved to dynamic import inside loader
import type { Route } from "./+types/packages";

// ─── Loader (Supabase) ──────────────────────────────────────────
export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { profile, gymId } = await requireGymAuth(request);
    const { getActivePlans } = await import("~/services/plan.server");
    const { getActiveEvents } = await import("~/services/event.server");

    const [[rawPlans, rawEvents], gymResult] = await Promise.all([
        Promise.all([getActivePlans(gymId), getActiveEvents(gymId)]),
        supabaseAdmin.from("gyms").select("brand_color, primary_color").eq("id", gymId).single(),
    ]);

    const brandColor = gymResult.data?.brand_color || gymResult.data?.primary_color || "#7c3aed";

    const packages = rawPlans.map(p => ({
        id: p.id,
        name: p.name,
        classes: p.credits ?? 999,
        price: p.price,
        popular: p.is_popular,
        features: p.features.length > 0 ? p.features : [
            "Acceso a todas las clases",
            `Válido por ${p.validity_days} días`,
            p.credits === null ? "Clases ilimitadas" : `${p.credits} créditos incluidos`,
        ],
    }));

    const events = rawEvents.map(e => {
        const d = new Date(e.start_time);
        return {
            id: e.id,
            name: e.name,
            date: d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
            price: e.price,
            spaces: Math.max(0, e.max_capacity - e.current_enrolled),
            image: "🎉",
            description: e.description,
        };
    });

    return { packages, upgrades: [], events, brandColor };
}

export default function Packages({ loaderData }: Route.ComponentProps) {
    const { packages, upgrades, events, brandColor } = loaderData as any;
    const brand = brandColor || "#7c3aed";

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-2xl font-bold text-white">Paquetes y Eventos</h1>
                <p className="text-white/60 mt-1">
                    Adquiere nuevas clases, mejora tu plan actual o inscríbete a eventos especiales.
                </p>
            </div>

            {/* Packages Section */}
            <section>
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">Paquetes de Clases</h2>
                    <p className="text-sm text-white/60">Nuestros planes regulares para tu entrenamiento.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {packages.map((pkg: any) => (
                        <div
                            key={pkg.id}
                            className={`bg-white/5 rounded-2xl border p-6 shadow-sm relative overflow-hidden flex flex-col`}
                            style={pkg.popular ? { borderColor: brand, boxShadow: `0 0 0 2px ${brand}30` } : { borderColor: "rgba(255,255,255,0.1)" }}
                        >
                            {pkg.popular && (
                                <div
                                    className="absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider"
                                    style={{ backgroundColor: brand }}
                                >
                                    Más Popular
                                </div>
                            )}
                            <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-3xl font-black text-white">${pkg.price}</span>
                                <span className="text-white/60 text-sm font-medium">MXN</span>
                            </div>
                            <div
                                className="font-bold px-3 py-1.5 rounded-lg inline-block w-fit mt-3 text-sm text-white"
                                style={{ backgroundColor: `${brand}20`, color: brand }}
                            >
                                {pkg.classes} Clases
                            </div>

                            <ul className="mt-6 mb-8 space-y-3 flex-1">
                                {pkg.features.map((feature: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: brand }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={`/dashboard/checkout/${pkg.id}`}
                                className="w-full text-center py-2.5 rounded-xl font-bold text-sm transition-all text-white hover:opacity-90"
                                style={{ backgroundColor: brand }}
                            >
                                Adquirir Paquete
                            </a>
                        </div>
                    ))}
                </div>
            </section>

            {/* Upgrades Section */}
            <section>
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">Mejora tu Paquete</h2>
                    <p className="text-sm text-white/60">¿Te quedaste corto? Sube de nivel pagando solo la diferencia.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upgrades.map((upg: any) => (
                        <div key={upg.id} className="bg-gradient-to-br from-indigo-500/10 to-white border border-indigo-500/20 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded" style={{ backgroundColor: brand }}>UPGRADE</span>
                                    <h3 className="font-bold text-white">{upg.name}</h3>
                                </div>
                                <p className="text-sm text-white/70 mb-2">{upg.description}</p>
                                <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                                    <span className="line-through">De {upg.from}</span>
                                    <span>→</span>
                                    <span style={{ color: brand }}>A {upg.to}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                                <div className="text-2xl font-black text-white">${upg.price}</div>
                                <div className="text-xs text-green-600 font-medium mb-3">Ahorras ${upg.savings}</div>
                                <button className="w-full sm:w-auto text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors hover:opacity-90" style={{ backgroundColor: brand }}>
                                    Mejorar Ahora
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Events Section */}
            <section>
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white">Eventos Especiales</h2>
                    <p className="text-sm text-white/60">Experiencias únicas para llevar tu entrenamiento al siguiente nivel.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {events.map((evt: any) => (
                        <div key={evt.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <div className="h-32 flex items-center justify-center text-5xl" style={{ backgroundColor: `${brand}15` }}>
                                {evt.image}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-white text-lg mb-1">{evt.name}</h3>
                                <p className="text-xs font-semibold mb-3" style={{ color: brand }}>{evt.date}</p>
                                <p className="text-sm text-white/70 mb-4 flex-1">{evt.description}</p>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
                                    <div>
                                        <div className="text-lg font-black text-white">${evt.price}</div>
                                        <div className="text-[10px] text-white/60 font-medium">{evt.spaces} lugares restantes</div>
                                    </div>
                                    <button className="text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors hover:opacity-90" style={{ backgroundColor: brand }}>
                                        Inscribirse
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
