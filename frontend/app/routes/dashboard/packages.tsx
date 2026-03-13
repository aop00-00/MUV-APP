// Auth service moved to dynamic import inside loader
import type { Route } from "./+types/packages";

// ─── Mock Data ───────────────────────────────────────────────────
const MOCK_PACKAGES = [
    {
        id: "pkg-001",
        name: "Starter Pack",
        classes: 5,
        price: 450,
        popular: false,
        features: ["Acceso a todas las clases", "Válido por 30 días", "Reserva con 2 días de anticipación"]
    },
    {
        id: "pkg-002",
        name: "Pro Pack",
        classes: 10,
        price: 799,
        popular: true,
        features: ["Acceso a todas las clases", "Válido por 60 días", "Reserva con 7 días de anticipación", "1 bebida gratis"]
    },
    {
        id: "pkg-003",
        name: "Elite Pack",
        classes: 20,
        price: 1399,
        popular: false,
        features: ["Acceso a todas las clases", "Válido por 90 días", "Reserva VIP (14 días)", "Toalla y agua incluidas"]
    }
];

const MOCK_UPGRADES = [
    {
        id: "upg-001",
        name: "Mejora a Pro",
        from: "Starter Pack",
        to: "Pro Pack",
        price: 399,
        savings: 50,
        description: "Añade 5 clases más a tu paquete actual y obtén beneficios Pro."
    },
    {
        id: "upg-002",
        name: "Mejora a Elite",
        from: "Pro Pack",
        to: "Elite Pack",
        price: 650,
        savings: 150,
        description: "Da el salto al mejor paquete con acceso VIP y más tiempo."
    }
];

const MOCK_EVENTS = [
    {
        id: "evt-001",
        name: "Simulación Hyrox",
        date: "Sábado, 15 de Marzo - 08:00 AM",
        price: 250,
        spaces: 12,
        image: "🏃‍♂️",
        description: "Prepárate para la competencia con nuestro simulacro oficial. 90 minutos de intensidad."
    },
    {
        id: "evt-002",
        name: "Inmersión en Hielo",
        date: "Domingo, 23 de Marzo - 10:00 AM",
        price: 150,
        spaces: 5,
        image: "🧊",
        description: "Recuperación activa guiada con respiración Wim Hof y tinas de hielo."
    },
    {
        id: "evt-003",
        name: "Muv Bootcamp 2.0",
        date: "Sábado, 5 de Abril - 07:00 AM",
        price: 400,
        spaces: 30,
        image: "🏕️",
        description: "Un reto al aire libre de 3 horas. Trabajo en equipo, fuerza y mucha diversión."
    }
];

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAuth(request);
    return {
        packages: MOCK_PACKAGES,
        upgrades: MOCK_UPGRADES,
        events: MOCK_EVENTS
    };
}

export default function Packages({ loaderData }: Route.ComponentProps) {
    const { packages, upgrades, events } = loaderData;

    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Paquetes y Eventos</h1>
                <p className="text-gray-500 mt-1">
                    Adquiere nuevas clases, mejora tu plan actual o inscríbete a eventos especiales.
                </p>
            </div>

            {/* Packages Section */}
            <section>
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Paquetes de Clases</h2>
                    <p className="text-sm text-gray-500">Nuestros planes regulares para tu entrenamiento.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {packages.map((pkg: any) => (
                        <div key={pkg.id} className={`bg-white rounded-2xl border ${pkg.popular ? 'border-blue-500 shadow-blue-100' : 'border-gray-200'} p-6 shadow-sm relative overflow-hidden flex flex-col`}>
                            {pkg.popular && (
                                <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                                    Más Popular
                                </div>
                            )}
                            <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-3xl font-black text-gray-900">${pkg.price}</span>
                                <span className="text-gray-500 text-sm font-medium">MXN</span>
                            </div>
                            <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg inline-block w-fit mt-3 text-sm">
                                {pkg.classes} Clases
                            </div>

                            <ul className="mt-6 mb-8 space-y-3 flex-1">
                                {pkg.features.map((feature: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                        <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <a
                                href={`/dashboard/checkout/${pkg.id}`}
                                className={`w-full text-center py-2.5 rounded-xl font-bold text-sm transition-colors ${pkg.popular
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                                    }`}
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
                    <h2 className="text-xl font-bold text-gray-900">Mejora tu Paquete</h2>
                    <p className="text-sm text-gray-500">¿Te quedaste corto? Sube de nivel pagando solo la diferencia.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upgrades.map((upg: any) => (
                        <div key={upg.id} className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">UPGRADE</span>
                                    <h3 className="font-bold text-gray-900">{upg.name}</h3>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{upg.description}</p>
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                    <span className="line-through">De {upg.from}</span>
                                    <span>→</span>
                                    <span className="text-indigo-700">A {upg.to}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
                                <div className="text-2xl font-black text-gray-900">${upg.price}</div>
                                <div className="text-xs text-green-600 font-medium mb-3">Ahorras ${upg.savings}</div>
                                <button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors">
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
                    <h2 className="text-xl font-bold text-gray-900">Eventos Especiales</h2>
                    <p className="text-sm text-gray-500">Experiencias únicas para llevar tu entrenamiento al siguiente nivel.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {events.map((evt: any) => (
                        <div key={evt.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                            <div className="h-32 bg-gray-100 flex items-center justify-center text-5xl">
                                {evt.image}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-gray-900 text-lg mb-1">{evt.name}</h3>
                                <p className="text-xs text-blue-600 font-semibold mb-3">{evt.date}</p>
                                <p className="text-sm text-gray-600 mb-4 flex-1">{evt.description}</p>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                                    <div>
                                        <div className="text-lg font-black text-gray-900">${evt.price}</div>
                                        <div className="text-[10px] text-gray-500 font-medium">{evt.spaces} lugares restantes</div>
                                    </div>
                                    <button className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
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
