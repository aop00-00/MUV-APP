import { useState } from "react";
import type { Route } from "./+types/store";
import type { Product } from "~/types/database";

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { supabaseAdmin } = await import("~/services/supabase.server");
    const { gymId } = await requireGymAuth(request);

    // Fetch active products for this gym (excluding plan category)
    const { data: products } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .in("category", ["beverage", "supplement", "merch", "package"])
        .order("category", { ascending: true })
        .order("created_at", { ascending: true });

    return { products: products ?? [] };
}

export default function Store({ loaderData }: Route.ComponentProps) {
    const { products } = loaderData;
    const [filterCategory, setFilterCategory] = useState<string>("all");

    const categories: Record<string, string> = {
        beverage: "🥤 Bebidas",
        supplement: "💊 Suplementos",
        merch: "👕 Merchandise",
        package: "📦 Paquetes",
    };

    const filterOptions = [
        { id: "all", label: "Todo" },
        { id: "beverage", label: "Bebidas" },
        { id: "supplement", label: "Suplementos" },
        { id: "merch", label: "Merchandise" },
        { id: "package", label: "Paquetes" }
    ];

    const displayedProducts = filterCategory === "all"
        ? products
        : products.filter(p => p.category === filterCategory);

    const grouped = displayedProducts.reduce(
        (acc, product) => {
            const cat = product.category;
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(product);
            return acc;
        },
        {} as Record<string, Product[]>
    );

    return (
        <div className="space-y-10 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight">Tienda</h1>
                    <p className="text-white/60 mt-2 max-w-md text-lg">
                        Productos oficiales de <span className="text-blue-600 font-bold">tu centro</span> para potenciar tu entrenamiento.
                    </p>
                </div>
                {/* Filter Bar */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-white/10 rounded-2xl w-fit">
                    {filterOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setFilterCategory(option.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterCategory === option.id
                                ? "bg-white/5 text-blue-600 shadow-sm"
                                : "text-white/50 hover:text-white/70"
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {Object.keys(grouped).length > 0 ? (
                (Object.entries(grouped) as [string, Product[]][]).map(([category, items]) => (
                    <section key={category} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-white flex-shrink-0 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-600" />
                                {categories[category] ?? category}
                            </h2>
                            <div className="h-[1px] w-full bg-gradient-to-r from-gray-100 to-transparent" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {items.map((product) => (
                                <div
                                    key={product.id}
                                    className="bg-white/5 border border-white/10 rounded-[32px] overflow-hidden group hover:border-blue-200 transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col relative"
                                >
                                    {product.stock <= 5 && product.stock > 0 && (
                                        <div className="absolute top-4 right-4 z-10 bg-amber-100 text-amber-600 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                                            Últimas unidades
                                        </div>
                                    )}
                                    
                                    <div className="p-8 flex flex-col flex-1">
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-extrabold text-white text-xl tracking-tight group-hover:text-blue-600 transition-colors">{product.name}</h3>
                                            </div>
                                            {product.description ? (
                                                <p className="text-sm text-white/50 mt-2 line-clamp-3 leading-relaxed">
                                                    {product.description}
                                                </p>
                                            ) : (
                                                <p className="text-sm text-white/40 italic mt-2">Sin descripción disponible.</p>
                                            )}
                                        </div>
                                        
                                        <div className="mt-8 flex items-end justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1">Inversión</span>
                                                <span className="text-3xl font-black text-white">
                                                    ${Number(product.price).toFixed(2)}
                                                </span>
                                            </div>
                                            <button
                                                className="px-8 py-3.5 bg-gray-900 text-white font-black text-xs rounded-2xl hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-200 disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none uppercase tracking-[0.15em]"
                                                disabled={product.stock === 0}
                                            >
                                                {product.stock === 0 ? "Agotado" : "Adquirir"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))
            ) : (
                <div className="bg-white/5 rounded-[40px] p-24 text-center border border-white/10 shadow-sm">
                    <div className="bg-white/5 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 animate-bounce transition-all duration-1000">
                        <span className="text-4xl text-white/40">📦</span>
                    </div>
                    <h3 className="text-white text-2xl font-black tracking-tight">Catálogo pendiente</h3>
                    <p className="text-white/50 text-sm mt-4 max-w-xs mx-auto leading-relaxed">
                        {filterCategory === "all"
                            ? "Aún no hay artículos disponibles en este centro. Vuelve pronto para ver las novedades."
                            : `No hay artículos disponibles en la categoría ${filterOptions.find(o => o.id === filterCategory)?.label}.`}
                    </p>
                </div>
            )}
        </div>
    );
}
