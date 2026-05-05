// app/services/payment.server.ts
// Mercado Pago integration – creates checkout preferences.
//
// ─── TWO INDEPENDENT PAYMENT FLOWS ──────────────────────────────────────────
//
//  Flow 1 (SaaS B2B) — Gym owner buys a software plan (onboarding).
//    Token:  MERCADO_PAGO_ACCESS_TOKEN_SAAS env var → creador's concentrator account.
//    Helper: getSaasToken()
//
//  Flow 2 (Tenant B2C) — Gym member buys a membership or product.
//    Token:  gyms.mp_access_token column for the specific gym_id → gym owner's account.
//    Helper: getGymMpToken(gymId)
//
// NEVER mix these two flows or their tokens.

import type { Product } from "~/types/database";

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

// ── Fuente única de verdad para precios SaaS ──────────────────────────────
// NUNCA leer el precio desde el cliente. Siempre calcularlo aquí en el servidor.
export type SaasPlanId = "starter" | "pro" | "elite";
export type SaasCycle = "monthly" | "quarterly" | "annual";

export const SAAS_PLAN_PRICES: Record<SaasPlanId, Record<SaasCycle, number>> = {
    starter: { monthly: 999,  quarterly: 2697,  annual: 9588  },
    pro:     { monthly: 2099, quarterly: 5667,  annual: 20148 },
    elite:   { monthly: 3499, quarterly: 9447,  annual: 33588 },
};

export const SAAS_CYCLE_MONTHS: Record<SaasCycle, number> = {
    monthly: 1,
    quarterly: 3,
    annual: 12,
};

/**
 * Retorna el precio exacto para un plan+ciclo SaaS.
 * Lanza si la combinación no existe — nunca devuelve un precio inventado.
 */
export function getSaasPlanPrice(plan: string, cycle: string): number {
    const planPrices = SAAS_PLAN_PRICES[plan as SaasPlanId];
    if (!planPrices) throw new Error(`Plan SaaS no reconocido: "${plan}"`);
    const price = planPrices[cycle as SaasCycle];
    if (price === undefined) throw new Error(`Ciclo no reconocido para ${plan}: "${cycle}"`);
    return price;
}

/**
 * Retorna el número de meses para un ciclo dado.
 */
export function getSaasCycleMonths(cycle: string): number {
    const months = SAAS_CYCLE_MONTHS[cycle as SaasCycle];
    if (!months) throw new Error(`Ciclo inválido: "${cycle}"`);
    return months;
}

interface MercadoPagoPreference {
    id: string;
    init_point: string;
    sandbox_init_point: string;
}

// ── Flow 1: SaaS concentrator account ─────────────────────────────────────
/**
 * Returns the Mercado Pago access token for the SaaS concentrator account.
 * Used ONLY in the onboarding (gym owner purchases a software plan).
 */
export function getSaasToken(): string {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN_SAAS;
    if (!token) {
        throw new Error(
            "Missing MERCADO_PAGO_ACCESS_TOKEN_SAAS env var. " +
            "This token is required for SaaS subscription payments."
        );
    }
    return token;
}

// ── Flow 2: Gym owner's account (per-tenant) ──────────────────────────────
/**
 * Reads the Mercado Pago access token for a specific gym from Supabase.
 * Used ONLY for B2C sales (memberships, products, POS) where the money
 * goes directly to the gym owner's bank account.
 *
 * @param gymId - The gym's UUID in the `gyms` table
 */
export async function getGymMpToken(gymId: string): Promise<string> {
    const { supabaseAdmin } = await import("./supabase.server");

    const { data, error } = await supabaseAdmin
        .from("gyms")
        .select("mp_access_token")
        .eq("id", gymId)
        .single();

    if (error) {
        throw new Error(`Failed to fetch MP token for gym ${gymId}: ${error.message}`);
    }

    if (!data?.mp_access_token) {
        throw new Error(
            `Gym ${gymId} has no Mercado Pago access token configured. ` +
            "The gym owner must connect their MP account in Settings → Pagos."
        );
    }

    return data.mp_access_token;
}

// ── Core: create a checkout preference ────────────────────────────────────
/**
 * Creates a Mercado Pago checkout preference and returns the `init_point`
 * URL where the user should be redirected to complete payment.
 *
 * @param item           - The product/package to purchase
 * @param userId         - The authenticated user's profile ID
 * @param mpAccessToken  - The MP access token for this specific flow:
 *                          • Flow 1 (SaaS): pass getSaasToken()
 *                          • Flow 2 (Tenant B2C): pass await getGymMpToken(gymId)
 * @param gymId          - Optional gym ID to embed in external_reference (B2C only)
 * @param currency       - Currency code from gym settings (defaults to MXN)
 * @returns              - init_point URL (redirect the user here)
 */
export async function createPreference(
    item: Product,
    userId: string,
    mpAccessToken: string,
    gymId?: string,
    currency: string = "MXN"
): Promise<string> {
    // Build external_reference — parsed by the webhook to route the event correctly.
    // Format: "flow:{saas|tenant}:order:pending:user:{userId}[:gym:{gymId}]"
    const flowType = gymId ? "tenant" : "saas";
    const externalRef = gymId
        ? `flow:${flowType}:order:pending:user:${userId}:gym:${gymId}`
        : `flow:${flowType}:order:pending:user:${userId}`;

    const body = {
        items: [
            {
                id: item.id,
                title: item.name,
                description: item.description ?? "",
                picture_url: item.image_url ?? undefined,
                category_id: item.category,
                quantity: 1,
                currency_id: currency,
                unit_price: item.price,
            },
        ],
        payer: {
            // In production, populate with real user info from profile
        },
        back_urls: {
            success: `${APP_URL}/dashboard/checkout/success`,
            failure: `${APP_URL}/dashboard/store`,
            pending: `${APP_URL}/dashboard/checkout/success`,
        },
        auto_return: "approved" as const,
        external_reference: externalRef,
        notification_url: `https://duvnfeuinxbrnmcslugm.supabase.co/functions/v1/mercado-pago`,
        statement_descriptor: "GRINDPROJECT",
    };

    const response = await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${mpAccessToken}`,
            },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `Error al crear preferencia de pago (HTTP ${response.status}): ${response.statusText}. Body: ${errorBody}`
        );
    }

    const preference: MercadoPagoPreference = await response.json();

    // In development use the sandbox URL; in production use the real one
    const isDev = process.env.NODE_ENV !== "production";
    return isDev ? preference.sandbox_init_point : preference.init_point;
}
