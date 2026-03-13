import { useState } from "react";
// Auth moved to dynamic import inside loader
import type { Route } from "./+types/store";
import type { Product } from "~/types/database";

const MOCK_PRODUCTS: Product[] = [
    {
        id: "bev-001", name: "Proteína Whey", description: "Shake de proteína post-workout.", price: 65,
        image_url: null, category: "beverage", stock: 24, is_active: true, created_at: "2025-01-01T00:00:00Z",
    },
    {
        id: "bev-002", name: "Smoothie Verde", description: "Espinaca, plátano y proteína vegetal.", price: 55,
        image_url: null, category: "beverage", stock: 15, is_active: true, created_at: "2025-01-01T00:00:00Z",
    },
    {
        id: "bev-003", name: "Americano", description: "Café negro recién preparado.", price: 35,
        image_url: null, category: "beverage", stock: 50, is_active: true, created_at: "2025-01-01T00:00:00Z",
    },
    {
        id: "sup-001", name: "Creatina 300g", description: "Monohidrato de creatina pura.", price: 280,
        image_url: null, category: "supplement", stock: 8, is_active: true, created_at: "2025-01-01T00:00:00Z",
    },
    {
        id: "mer-001", name: "Playera Grind", description: "Playera oficial Grind Project.", price: 350,
        image_url: null, category: "merch", stock: 12, is_active: true, created_at: "2025-01-01T00:00:00Z",
    },
];

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAuth } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAuth(request);
    return { products: MOCK_PRODUCTS };
}

export default function Store({ loaderData }: Route.ComponentProps) {
    const { products } = loaderData;
    const [filterCategory, setFilterCategory] = useState<string>("all");

    const categories: Record<string, string> = {
        beverage: "🥤 Bebidas",
        supplement: "💊 Suplementos",
        merch: "👕 Merchandise",
    };

    const filterOptions = [
        { id: "all", label: "Todo" },
        { id: "beverage", label: "Bebidas" },
        { id: "supplement", label: "Suplementos" },
        { id: "merch", label: "Merchandise" }
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
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tienda</h1>
                    <p className="text-gray-500 mt-1">
                        Compra bebidas, suplementos y merchandise oficial.
                    </p>
                </div>
                {/* Filter Bar */}
                <div className="flex flex-wrap gap-2">
                    {filterOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => setFilterCategory(option.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${filterCategory === option.id
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {Object.entries(grouped).map(([category, items]) => (
                <section key={category}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {categories[category] ?? category}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((product) => (
                            <div
                                key={product.id}
                                className="bg-white border border-gray-200 rounded-xl overflow-hidden group hover:border-blue-400 transition-colors shadow-sm"
                            >
                                <div className="p-5">
                                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                                    {product.description && (
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                            {product.description}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-blue-600 font-bold text-lg">
                                            ${product.price.toFixed(2)}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded">
                                                Stock: {product.stock}
                                            </span>
                                            <button
                                                className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                                                title="Añadir al carrito"
                                            >
                                                Comprar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );

}
