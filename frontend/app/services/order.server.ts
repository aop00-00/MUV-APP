// app/services/order.server.ts
// Order / POS operations using the real Supabase orders table.
//
// MULTITENANT: ALL functions require an explicit gymId parameter.

import { supabaseAdmin } from "./supabase.server";
import type { Order, PaymentMethod } from "~/types/database";

// ── Types ─────────────────────────────────────────────────────────
export interface CreateOrderParams {
    gymId: string;
    userId: string | null; // null for anonymous POS sales
    customerName: string | null;
    paymentMethod: PaymentMethod;
    items: { productId: string; name: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    tax: number;
    total: number;
}

// ── Create an order (POS checkout) ────────────────────────────────
export async function createOrder(params: CreateOrderParams): Promise<Order> {
    const { gymId, userId, customerName, paymentMethod, items, subtotal, tax, total } = params;

    // Insert the order
    const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
            gym_id: gymId,
            user_id: userId,
            customer_name: customerName,
            payment_method: paymentMethod,
            status: "paid",
            subtotal,
            tax,
            total,
        })
        .select()
        .single();

    if (orderError) throw new Error(`Error creating order: ${orderError.message}`);

    // Insert order items
    if (items.length > 0) {
        const orderItems = items.map((item) => ({
            order_id: order.id,
            product_id: item.productId,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
        }));

        const { error: itemsError } = await supabaseAdmin
            .from("order_items")
            .insert(orderItems);

        if (itemsError) {
            console.error(`Error inserting order items: ${itemsError.message}`);
        }
    }

    // Decrement stock for each product sold
    for (const item of items) {
        await supabaseAdmin.rpc("decrement_stock", {
            p_product_id: item.productId,
            p_quantity: item.quantity,
        }).then(({ error }) => {
            if (error) console.error(`Stock decrement failed for ${item.productId}:`, error.message);
        });
    }

    return order as Order;
}

// ── Charge to customer account ────────────────────────────────────
export async function chargeToAccount(params: {
    gymId: string;
    customerId: string;
    total: number;
    items: { productId: string; name: string; quantity: number; unitPrice: number }[];
    subtotal: number;
    tax: number;
}): Promise<Order> {
    // Create the order as "paid" via account
    const order = await createOrder({
        gymId: params.gymId,
        userId: params.customerId,
        customerName: null,
        paymentMethod: "cash", // account charges tracked as cash
        items: params.items,
        subtotal: params.subtotal,
        tax: params.tax,
        total: params.total,
    });

    // Deduct from user's balance using RPC for atomic operation
    await supabaseAdmin.rpc("deduct_balance", {
        p_user_id: params.customerId,
        p_amount: params.total,
    }).then(({ error: rpcError }) => {
        if (rpcError) console.error(`Balance deduction failed:`, rpcError.message);
    });

    return order;
}

// ── Get products for POS ──────────────────────────────────────────
export async function getPosProducts(gymId: string) {
    const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("gym_id", gymId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

    if (error) throw new Error(`Error fetching products: ${error.message}`);
    return data ?? [];
}

// ── Get customers (profiles with balances) ────────────────────────
export async function getPosCustomers(gymId: string) {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, balance")
        .eq("gym_id", gymId)
        .eq("role", "member")  // Fixed: role is "member" not "user"
        .order("full_name", { ascending: true });

    if (error) throw new Error(`Error fetching customers: ${error.message}`);
    return (data ?? []).map((p: any) => ({
        id: p.id,
        name: p.full_name ?? p.email ?? "Sin nombre",
        balance: p.balance ?? 0,
        hasCard: true,
    }));
}

// ── Get today's orders (for finance/corte de caja) ────────────────
export async function getTodayOrders(gymId: string): Promise<Order[]> {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabaseAdmin
        .from("orders")
        .select("*, items:order_items(*)")
        .eq("gym_id", gymId)
        .gte("created_at", `${today}T00:00:00Z`)
        .order("created_at", { ascending: false });

    if (error) throw new Error(`Error fetching today orders: ${error.message}`);
    return (data ?? []) as Order[];
}
