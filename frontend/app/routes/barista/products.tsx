// app/routes/barista/products.tsx
// Barista – Active inventory with quick disable "Agotado por hoy" (MOCK DATA).
// Auth moved to dynamic import inside loader/action
import type { Route } from "./+types/products";
import { useFetcher } from "react-router";
import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, Package, Search } from "lucide-react";

interface InventoryProduct {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
    available: boolean;
}

const MOCK_INVENTORY: InventoryProduct[] = [
    { id: "bev-001", name: "Proteína Whey", price: 65, stock: 2, category: "Bebida", available: true },
    { id: "bev-002", name: "Smoothie Verde", price: 55, stock: 15, category: "Bebida", available: true },
    { id: "bev-003", name: "Americano", price: 35, stock: 50, category: "Bebida", available: true },
    { id: "bev-004", name: "Agua Mineral", price: 20, stock: 40, category: "Bebida", available: true },
    { id: "sup-001", name: "Creatina 300g", price: 280, stock: 3, category: "Suplemento", available: true },
    { id: "sup-002", name: "Barra Proteica", price: 45, stock: 30, category: "Suplemento", available: true },
    { id: "bev-005", name: "Leche de Almendra", price: 25, stock: 0, category: "Ingrediente", available: false },
    { id: "bev-006", name: "Matcha Latte", price: 60, stock: 8, category: "Bebida", available: true },
];

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymCoach } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymCoach(request);
    return { products: MOCK_INVENTORY };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymCoach } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymCoach(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const productId = formData.get("productId") as string;
    if (intent === "toggle_available") {
        // Would toggle availability in DB + hide from user app instantly
        return { success: true, productId, toggled: true };
    }
    return { success: true };
}

export default function BaristaProducts({ loaderData }: Route.ComponentProps) {
    const { products } = loaderData;
    const fetcher = useFetcher();
    const [search, setSearch] = useState("");
    const [disabledIds, setDisabledIds] = useState<Set<string>>(
        new Set(products.filter((p) => !p.available).map((p) => p.id))
    );

    const toggleDisabled = (id: string) => {
        setDisabledIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const LOW = 5;

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-stone-900">Inventario Rápido</h1>
                    <p className="text-stone-500 text-sm mt-0.5">
                        Deshabilita productos al instante. El usuario no podrá pedirlos.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                        <EyeOff className="w-3 h-3" /> {disabledIds.size} deshabilitados
                    </span>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                    type="text"
                    placeholder="Buscar producto…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm"
                />
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map((product) => {
                    const isDisabled = disabledIds.has(product.id);
                    const isLow = product.stock > 0 && product.stock <= LOW;
                    const isOut = product.stock <= 0;

                    return (
                        <div
                            key={product.id}
                            className={`rounded-2xl border-2 p-4 transition-all relative ${isDisabled
                                    ? "border-red-300 bg-red-50/50 opacity-60"
                                    : isOut
                                        ? "border-stone-300 bg-stone-100 opacity-50"
                                        : isLow
                                            ? "border-amber-300 bg-amber-50"
                                            : "border-stone-200 bg-white"
                                }`}
                        >
                            {/* Status badges */}
                            {isDisabled && (
                                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                    AGOTADO HOY
                                </div>
                            )}
                            {isLow && !isDisabled && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 mb-1">
                                    <AlertTriangle className="w-3 h-3" /> STOCK BAJO
                                </div>
                            )}
                            {isOut && !isDisabled && (
                                <div className="text-[10px] font-bold text-stone-400 mb-1">SIN STOCK</div>
                            )}

                            <p className="font-bold text-stone-900 text-sm">{product.name}</p>
                            <p className="text-amber-600 font-bold text-sm mt-0.5">${product.price}</p>
                            <div className="flex items-center justify-between mt-2 mb-3">
                                <span className={`text-xs font-medium ${isOut ? "text-red-500" : isLow ? "text-amber-600" : "text-stone-400"
                                    }`}>
                                    Stock: {product.stock}
                                </span>
                                <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                                    {product.category}
                                </span>
                            </div>

                            {/* Toggle button */}
                            <fetcher.Form method="post">
                                <input type="hidden" name="intent" value="toggle_available" />
                                <input type="hidden" name="productId" value={product.id} />
                                <button
                                    type="submit"
                                    onClick={() => toggleDisabled(product.id)}
                                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${isDisabled
                                            ? "bg-green-600 hover:bg-green-700 text-white"
                                            : "bg-red-100 hover:bg-red-200 text-red-700 border border-red-200"
                                        }`}
                                >
                                    {isDisabled ? (
                                        <>
                                            <Eye className="w-3.5 h-3.5" />
                                            Reactivar
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff className="w-3.5 h-3.5" />
                                            Agotado por hoy
                                        </>
                                    )}
                                </button>
                            </fetcher.Form>
                        </div>
                    );
                })}
            </div>

            {/* Quick Legend */}
            <div className="flex items-center gap-4 text-[10px] text-stone-400 pt-2">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-stone-200 bg-white" /> Normal</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-amber-300 bg-amber-50" /> Stock bajo (≤{LOW})</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded border-2 border-red-300 bg-red-50" /> Deshabilitado</span>
            </div>
        </div>
    );
}
