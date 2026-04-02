// app/routes/admin/pos.tsx
// Admin – POS with persistent cart, customer accounts (Supabase).
import type { Route } from "./+types/pos";
import { useFetcher } from "react-router";
import { useState } from "react";
import { ShoppingCart, Trash2, Search, User, CreditCard, Banknote, AlertTriangle, X, Plus, Minus, Package, Edit, Save } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────
interface POSProduct {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
    is_active: boolean;
    description: string | null;
}

interface CartItem {
    product: POSProduct;
    qty: number;
}

const LOW_STOCK_THRESHOLD = 5;

export async function loader({ request }: Route.LoaderArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const { getPosProducts, getPosCustomers } = await import("~/services/order.server");

    const [rawProducts, customers] = await Promise.all([
        getPosProducts(gymId),
        getPosCustomers(gymId),
    ]);

    const products: POSProduct[] = rawProducts.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock ?? 0,
        category: p.category ?? "Otro",
        is_active: p.is_active ?? true,
        description: p.description ?? null,
    }));

    return { products, customers };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireGymAdmin } = await import("~/services/gym.server");
    const { profile, gymId } = await requireGymAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent") as string;

    if (intent === "checkout") {
        const { createOrder } = await import("~/services/order.server");
        const method = formData.get("method") as "cash" | "card";
        const total = Number(formData.get("total") ?? 0);
        const itemsJson = formData.get("items") as string;
        const items = itemsJson ? JSON.parse(itemsJson) : [];
        const subtotal = Math.round(total / 1.16 * 100) / 100;
        const tax = Math.round((total - subtotal) * 100) / 100;

        await createOrder({
            gymId,
            userId: profile.id,
            customerName: null,
            paymentMethod: method,
            items,
            subtotal,
            tax,
            total,
        });

        return { success: true, message: "Venta completada." };
    }

    if (intent === "charge_account") {
        const { chargeToAccount } = await import("~/services/order.server");
        const customerId = formData.get("customerId") as string;
        const total = Number(formData.get("total") ?? 0);
        const itemsJson = formData.get("items") as string;
        const items = itemsJson ? JSON.parse(itemsJson) : [];
        const subtotal = Math.round(total / 1.16 * 100) / 100;
        const tax = Math.round((total - subtotal) * 100) / 100;

        await chargeToAccount({
            gymId,
            customerId,
            total,
            items,
            subtotal,
            tax,
        });

        return { success: true, message: "Cargo a cuenta registrado." };
    }

    if (intent === "upsert_product") {
        const { upsertProduct } = await import("~/services/product.server");
        const id = formData.get("id") as string;

        // Enforce per-plan POS product limits (creation only, not edits)
        // DB trigger is the hard stop, this is the UX layer
        if (!id) {
            const { PLAN_FEATURES } = await import("~/config/plan-features");
            const { supabaseAdmin: supa } = await import("~/services/supabase.server");
            const { data: gymData } = await supa.from("gyms").select("plan_id").eq("id", gymId).single();
            const gymPlanDef = PLAN_FEATURES[(gymData?.plan_id || "starter") as keyof typeof PLAN_FEATURES];
            const maxProducts = gymPlanDef?.maxPosProducts;
            
            if (maxProducts != null) { // null = unlimited
                const { getPosProducts } = await import("~/services/order.server");
                const existing = await getPosProducts(gymId);
                if (existing.length >= maxProducts) {
                    return {
                        success: false,
                        message: `Tu plan ${gymPlanDef.label} permite máximo ${maxProducts} productos en el POS. Actualiza a Starter para agregar más.`,
                        limitReached: "pos_products",
                    };
                }
            }
        }
        const name = formData.get("name") as string;
        const category = formData.get("category") as any;
        const price = Number(formData.get("price"));
        const stock = Number(formData.get("stock"));
        const description = formData.get("description") as string;

        await upsertProduct(gymId, {
            id: id || undefined,
            name,
            category,
            price,
            stock,
            description,
        });
        return { success: true, message: id ? "Producto actualizado." : "Producto creado." };
    }

    if (intent === "delete_product") {
        const { deleteProduct } = await import("~/services/product.server");
        const productId = formData.get("productId") as string;
        await deleteProduct(gymId, productId);
        return { success: true, message: "Producto eliminado." };
    }

    if (intent === "toggle_active") {
        const { toggleProductActive } = await import("~/services/product.server");
        const productId = formData.get("productId") as string;
        const isActive = formData.get("isActive") === "true";
        await toggleProductActive(gymId, productId, !isActive);
        return { success: true };
    }

    return { success: true };
}

export default function POS({ loaderData }: Route.ComponentProps) {
    const { products, customers } = loaderData;
    const fetcher = useFetcher();
    const [view, setView] = useState<"pos" | "inventory">("pos");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerSearch, setCustomerSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<typeof customers[0] | null>(null);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [editingProduct, setEditingProduct] = useState<POSProduct | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

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
        <div className="space-y-6">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">{view === "pos" ? "Punto de Venta" : "Inventario"}</h1>
                    <p className="text-white/50 mt-1">
                        {view === "pos" ? "Toca un producto para agregar al carrito." : "Gestiona el catálogo de productos de tu tienda."}
                    </p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setView("pos")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${view === "pos" ? "bg-purple-600 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        Venta
                    </button>
                    <button
                        onClick={() => setView("inventory")}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${view === "inventory" ? "bg-purple-600 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                    >
                        <Package className="w-4 h-4" />
                        Inventario
                    </button>
                </div>
            </div>

            {view === "pos" ? (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-220px)]">
                    {/* ── Product Grid (left) ──────────────────── */}
                    <div className="flex-1 space-y-4 w-full">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {products.filter(p => p.is_active).map((product) => {
                                const isLowStock = product.stock <= LOW_STOCK_THRESHOLD;
                                const isOutOfStock = product.stock <= 0;

                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => !isOutOfStock && addToCart(product)}
                                        disabled={isOutOfStock}
                                        className={`text-left rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm ${isOutOfStock
                                            ? "bg-white/5 border-2 border-white/10 opacity-50 cursor-not-allowed"
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
                    <div className="w-full lg:w-96 bg-white/5 border border-white/[0.08] rounded-2xl shadow-lg flex flex-col overflow-hidden flex-shrink-0 lg:sticky lg:top-4 h-fit max-h-[calc(100vh-100px)]">
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
                                    <div key={item.product.id} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg p-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                                            <p className="text-xs text-purple-600 font-bold">${(item.product.price * item.qty).toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white/60 flex items-center justify-center transition-colors">
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs font-bold w-5 text-center text-white">{item.qty}</span>
                                            <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white/60 flex items-center justify-center transition-colors">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-red-400 hover:text-red-500 transition-colors ml-1">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Cart totals + actions */}
                        <div className="border-t border-white/5 p-4 space-y-3 bg-white/5">
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
                                <div className="flex items-center justify-between bg-purple-600/20 border border-purple-500/30 rounded-lg p-2.5">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-purple-400" />
                                        <div>
                                            <p className="text-xs font-medium text-white">{selectedCustomer.name}</p>
                                            <p className="text-[10px] text-purple-300">Saldo: ${selectedCustomer.balance}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedCustomer(null)} className="text-white/40 hover:text-white">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                                        className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white/70 bg-white/5 border border-white/10 rounded-lg px-3 py-2 transition-colors"
                                    >
                                        <Search className="w-3.5 h-3.5" />
                                        Asignar a cuenta de cliente…
                                    </button>
                                    {showCustomerSearch && (
                                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-10 overflow-hidden">
                                            <input
                                                type="text"
                                                placeholder="Buscar cliente…"
                                                value={customerSearch}
                                                onChange={(e) => setCustomerSearch(e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-transparent border-b border-white/5 text-white outline-none"
                                                autoFocus
                                            />
                                            <div className="max-h-40 overflow-y-auto">
                                                {filteredCustomers.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerSearch(""); }}
                                                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm flex items-center justify-between text-white"
                                                    >
                                                        <span className="font-medium">{c.name}</span>
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
                                <fetcher.Form method="post" onSubmit={() => { setCart([]); setSelectedCustomer(null); }}>
                                    <input type="hidden" name="intent" value="checkout" />
                                    <input type="hidden" name="method" value="cash" />
                                    <input type="hidden" name="total" value={total} />
                                    <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                    <button
                                        type="submit"
                                        disabled={cart.length === 0}
                                        className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                                    >
                                        <Banknote className="w-4 h-4" />
                                        Efectivo
                                    </button>
                                </fetcher.Form>
                                <fetcher.Form method="post" onSubmit={() => { setCart([]); setSelectedCustomer(null); }}>
                                    <input type="hidden" name="intent" value="checkout" />
                                    <input type="hidden" name="method" value="card" />
                                    <input type="hidden" name="total" value={total} />
                                    <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
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
                                <fetcher.Form method="post" onSubmit={() => { setCart([]); setSelectedCustomer(null); }}>
                                    <input type="hidden" name="intent" value="charge_account" />
                                    <input type="hidden" name="customerId" value={selectedCustomer.id} />
                                    <input type="hidden" name="total" value={total} />
                                    <input type="hidden" name="items" value={JSON.stringify(cart.map(c => ({ productId: c.product.id, name: c.product.name, quantity: c.qty, unitPrice: c.product.price })))} />
                                    <button
                                        type="submit"
                                        disabled={cart.length === 0}
                                        className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        Cuenta ({selectedCustomer.name.split(" ")[0]})
                                    </button>
                                </fetcher.Form>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Catálogo de Productos</h2>
                        <button
                            onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Añadir Producto
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                                    <th className="px-4 py-3 font-medium">Producto</th>
                                    <th className="px-4 py-3 font-medium">Categoría</th>
                                    <th className="px-4 py-3 font-medium">Precio</th>
                                    <th className="px-4 py-3 font-medium">Stock</th>
                                    <th className="px-4 py-3 font-medium">Estado</th>
                                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {products.map((p) => (
                                    <tr key={p.id} className="text-white hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="font-bold">{p.name}</div>
                                            {p.description && <div className="text-xs text-white/40 line-clamp-1">{p.description}</div>}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60 uppercase">{p.category}</span>
                                        </td>
                                        <td className="px-4 py-4 font-bold text-purple-400">${p.price.toFixed(2)}</td>
                                        <td className="px-4 py-4">
                                            <span className={`font-medium ${p.stock <= LOW_STOCK_THRESHOLD ? "text-red-400" : "text-white/60"}`}>
                                                {p.stock} uni.
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <fetcher.Form method="post">
                                                <input type="hidden" name="intent" value="toggle_active" />
                                                <input type="hidden" name="productId" value={p.id} />
                                                <input type="hidden" name="isActive" value={String(p.is_active)} />
                                                <button
                                                    type="submit"
                                                    className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${p.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                                                >
                                                    {p.is_active ? "Activo" : "Oculto"}
                                                </button>
                                            </fetcher.Form>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => { setEditingProduct(p); setShowAddModal(true); }}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <fetcher.Form method="post" onSubmit={(e) => { if (!confirm("¿Eliminar producto?")) e.preventDefault(); }}>
                                                    <input type="hidden" name="intent" value="delete_product" />
                                                    <input type="hidden" name="productId" value={p.id} />
                                                    <button type="submit" className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-all">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </fetcher.Form>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal for Add/Edit */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl mx-4 my-auto max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 shrink-0">
                            <h3 className="text-xl font-bold text-white">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</h3>
                            <button onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="text-white/40 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <fetcher.Form method="post" className="p-6 space-y-4 overflow-y-auto" onSubmit={() => { setShowAddModal(false); setEditingProduct(null); }}>
                            <input type="hidden" name="intent" value="upsert_product" />
                            {editingProduct && <input type="hidden" name="id" value={editingProduct.id} />}
                            
                            <div>
                                <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Nombre del Producto</label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    defaultValue={editingProduct?.name}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                    placeholder="Ej. Proteína Whey 1kg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Categoría</label>
                                    <select
                                        name="category"
                                        required
                                        defaultValue={editingProduct?.category || "beverage"}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all appearance-none"
                                    >
                                        <option value="beverage">Bebida</option>
                                        <option value="supplement">Suplemento</option>
                                        <option value="merch">Mercancía</option>
                                        <option value="package">Paquete</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Precio ($)</label>
                                    <input
                                        name="price"
                                        type="number"
                                        step="0.01"
                                        required
                                        defaultValue={editingProduct?.price}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Stock Inicial</label>
                                    <input
                                        name="stock"
                                        type="number"
                                        required
                                        defaultValue={editingProduct?.stock || 0}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <p className="text-[10px] text-white/30 italic mb-1.5">Aparecerá en el POS y Tienda si el stock es &gt; 0</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/40 mb-1.5 uppercase tracking-wider">Descripción (Opcional)</label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    defaultValue={editingProduct?.description || ""}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-all resize-none"
                                    placeholder="Detalles sobre el producto…"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-2"
                            >
                                <Save className="w-4 h-4" />
                                {editingProduct ? "Actualizar Producto" : "Crear Producto"}
                            </button>
                        </fetcher.Form>
                    </div>
                </div>
            )}
        </div>
    );
}
