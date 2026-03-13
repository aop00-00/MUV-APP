// app/routes/admin/pos.tsx
// Admin – POS with persistent cart, customer accounts, low stock (MOCK DATA).
// Auth moved to dynamic import inside loader/action
import type { Route } from "./+types/pos";
import { useFetcher } from "react-router";
import { useState } from "react";
import { ShoppingCart, Trash2, Search, User, CreditCard, Banknote, AlertTriangle, X, Plus, Minus } from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────
interface POSProduct {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
}

interface CartItem {
    product: POSProduct;
    qty: number;
}

const MOCK_POS_PRODUCTS: POSProduct[] = [
    { id: "bev-001", name: "Proteína Whey", price: 65, stock: 2, category: "Bebida" },
    { id: "bev-002", name: "Smoothie Verde", price: 55, stock: 15, category: "Bebida" },
    { id: "bev-003", name: "Americano", price: 35, stock: 50, category: "Bebida" },
    { id: "bev-004", name: "Agua Mineral", price: 20, stock: 40, category: "Bebida" },
    { id: "sup-001", name: "Creatina 300g", price: 280, stock: 3, category: "Suplemento" },
    { id: "sup-002", name: "Barra Proteica", price: 45, stock: 30, category: "Suplemento" },
    { id: "mer-001", name: "Playera Grind", price: 350, stock: 12, category: "Merch" },
    { id: "mer-002", name: "Botella Grind", price: 180, stock: 20, category: "Merch" },
];

const MOCK_CUSTOMERS = [
    { id: "u-001", name: "María García", balance: 450, hasCard: true },
    { id: "u-002", name: "Pedro López", balance: 0, hasCard: false },
    { id: "u-004", name: "Roberto Sánchez", balance: 1200, hasCard: true },
    { id: "u-006", name: "Carlos Ramírez", balance: 80, hasCard: true },
];

const LOW_STOCK_THRESHOLD = 5;

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    return { products: MOCK_POS_PRODUCTS, customers: MOCK_CUSTOMERS };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    if (intent === "checkout") {
        return { success: true, message: "Venta completada." };
    }
    if (intent === "charge_account") {
        return { success: true, message: "Cargo a cuenta registrado." };
    }
    return { success: true };
}

export default function POS({ loaderData }: Route.ComponentProps) {
    const { products, customers } = loaderData;
    const fetcher = useFetcher();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<typeof customers[0] | null>(null);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);

    const addToCart = (product: POSProduct) => {
        setCart((prev) => {
            const existing = prev.find((c) => c.product.id === product.id);
            if (existing) {
                return prev.map((c) => c.product.id === product.id ? { ...c, qty: c.qty + 1 } : c);
            }
            return [...prev, { product, qty: 1 }];
        });
    };

    const updateQty = (productId: string, delta: number) => {
        setCart((prev) =>
            prev.map((c) => c.product.id === productId ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter((c) => c.qty > 0)
        );
    };

    const removeFromCart = (productId: string) => {
        setCart((prev) => prev.filter((c) => c.product.id !== productId));
    };

    const subtotal = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
    const tax = Math.round(subtotal * 0.16 * 100) / 100;
    const total = subtotal + tax;

    const filteredCustomers = customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
    );

    return (
        <div className="flex gap-6 min-h-[calc(100vh-160px)]">
            {/* ── Product Grid (left) ──────────────────── */}
            <div className="flex-1 space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Punto de Venta</h1>
                    <p className="text-white/50 mt-1">Toca un producto para agregar al carrito.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {products.map((product) => {
                        const isLowStock = product.stock <= LOW_STOCK_THRESHOLD;
                        const isOutOfStock = product.stock <= 0;

                        return (
                            <button
                                key={product.id}
                                onClick={() => !isOutOfStock && addToCart(product)}
                                disabled={isOutOfStock}
                                className={`text-left rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm ${isOutOfStock
                                    ? "bg-white/5/10 border-2 border-white/10 opacity-50 cursor-not-allowed"
                                    : isLowStock
                                        ? "bg-white/5 border-2 border-red-300 hover:border-red-400"
                                        : "bg-white/5 border border-white/[0.08] hover:border-purple-400 hover:shadow-md"
                                    }`}
                            >
                                {isLowStock && !isOutOfStock && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 mb-1.5">
                                        <AlertTriangle className="w-3 h-3" />
                                        LOW STOCK
                                    </div>
                                )}
                                {isOutOfStock && (
                                    <div className="text-[10px] font-bold text-white/40 mb-1.5">AGOTADO</div>
                                )}
                                <p className="font-semibold text-white text-sm">{product.name}</p>
                                <p className="text-purple-600 font-bold mt-1">${product.price.toFixed(2)}</p>
                                <div className="flex items-center justify-between mt-1.5">
                                    <p className={`text-xs ${isLowStock ? "text-red-500 font-medium" : "text-white/40"}`}>
                                        Stock: {product.stock}
                                    </p>
                                    <span className="text-[10px] text-white/40 bg-white/5/10 px-1.5 py-0.5 rounded">{product.category}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Cart Panel (right) ───────────────────── */}
            <div className="w-80 bg-white/5 border border-white/[0.08] rounded-2xl shadow-lg flex flex-col overflow-hidden flex-shrink-0">
                {/* Cart header */}
                <div className="p-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-purple-600" />
                            <h2 className="font-bold text-white">Carrito</h2>
                        </div>
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full font-medium">
                            {cart.reduce((s, c) => s + c.qty, 0)} items
                        </span>
                    </div>
                </div>

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.length === 0 ? (
                        <div className="text-center py-8 text-white/30">
                            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Carrito vacío</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.product.id} className="flex items-center gap-2 bg-white/5 rounded-lg p-2.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                                    <p className="text-xs text-purple-600 font-bold">${(item.product.price * item.qty).toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 bg-white/5/20 hover:bg-gray-300 rounded text-white/60 flex items-center justify-center transition-colors">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                                    <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 bg-white/5/20 hover:bg-gray-300 rounded text-white/60 flex items-center justify-center transition-colors">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart totals + actions */}
                <div className="border-t border-white/5 p-4 space-y-3 bg-white/5">
                    {/* Totals */}
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-white/50">
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-white/50">
                            <span>IVA (16%)</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-lg text-white pt-1 border-t border-white/5">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Customer assignment */}
                    {selectedCustomer ? (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-600" />
                                <div>
                                    <p className="text-xs font-medium text-blue-800">{selectedCustomer.name}</p>
                                    <p className="text-[10px] text-blue-500">Saldo: ${selectedCustomer.balance}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="text-blue-400 hover:text-blue-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                                className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white/70 bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 transition-colors"
                            >
                                <Search className="w-3.5 h-3.5" />
                                Asignar a cuenta de cliente…
                            </button>
                            {showCustomerSearch && (
                                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white/5 border border-white/[0.08] rounded-xl shadow-xl z-10 overflow-hidden">
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente…"
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm border-b border-white/5"
                                        autoFocus
                                    />
                                    <div className="max-h-40 overflow-y-auto">
                                        {filteredCustomers.map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerSearch(""); }}
                                                className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm flex items-center justify-between"
                                            >
                                                <span className="font-medium text-white">{c.name}</span>
                                                <span className="text-xs text-white/40">Saldo: ${c.balance}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="checkout" />
                            <input type="hidden" name="method" value="cash" />
                            <input type="hidden" name="total" value={total} />
                            <button
                                type="submit"
                                disabled={cart.length === 0}
                                className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                            >
                                <Banknote className="w-4 h-4" />
                                Efectivo
                            </button>
                        </fetcher.Form>
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="checkout" />
                            <input type="hidden" name="method" value="card" />
                            <input type="hidden" name="total" value={total} />
                            <button
                                type="submit"
                                disabled={cart.length === 0}
                                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                            >
                                <CreditCard className="w-4 h-4" />
                                Tarjeta
                            </button>
                        </fetcher.Form>
                    </div>

                    {selectedCustomer && (
                        <fetcher.Form method="post">
                            <input type="hidden" name="intent" value="charge_account" />
                            <input type="hidden" name="customerId" value={selectedCustomer.id} />
                            <input type="hidden" name="total" value={total} />
                            <button
                                type="submit"
                                disabled={cart.length === 0}
                                className="w-full flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                            >
                                <User className="w-4 h-4" />
                                Cargar a cuenta de {selectedCustomer.name.split(" ")[0]}
                            </button>
                        </fetcher.Form>
                    )}

                    {fetcher.data && "success" in fetcher.data && fetcher.data.success && (
                        <p className="text-xs text-green-600 font-medium text-center">✅ {fetcher.data.message}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
