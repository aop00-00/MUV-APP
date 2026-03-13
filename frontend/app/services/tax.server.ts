// app/services/tax.service.ts
// Fiscal receipt emission for MX (CFDI 4.0), AR (AFIP), CL (SII).
// Currently uses mock/webhook approach – swap provider URLs for production.

import type { Order } from "~/types/database";
import type { InvoiceRecord, TaxRegion } from "~/types/database";

// ─── Configuration ────────────────────────────────────────────────
const TAX_WEBHOOK_URLS: Record<TaxRegion, string> = {
    MX: process.env.CFDI_WEBHOOK_URL ?? "https://api.fiscalprovider.mx/cfdi/emit",
    AR: process.env.AFIP_WEBHOOK_URL ?? "https://api.fiscalprovider.ar/factura/emit",
    CL: process.env.SII_WEBHOOK_URL ?? "https://api.fiscalprovider.cl/boleta/emit",
};

const TAX_RATES: Record<TaxRegion, number> = {
    MX: 0.16,  // IVA 16%
    AR: 0.21,  // IVA 21%
    CL: 0.19,  // IVA 19%
};

// ─── Types ────────────────────────────────────────────────────────
interface ProviderPayload {
    reference_id: string;
    customer_email: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    tax_region: TaxRegion;
    description: string;
    issued_at: string;
}

interface ProviderResponse {
    success: boolean;
    uuid?: string;         // MX: CFDI UUID
    cae?: string;          // AR: CAE
    folio?: string;        // CL: Folio SII
    pdf_url?: string;
    xml_url?: string;
    error?: string;
}

// ─── Main Function ────────────────────────────────────────────────

/**
 * Emits a fiscal receipt (CFDI/AFIP/SII) for an order.
 * Calls the regional tax provider webhook and returns a typed InvoiceRecord.
 *
 * @param order      - The paid order to invoice
 * @param userEmail  - Customer email for the receipt
 * @param taxRegion  - Fiscal jurisdiction (MX | AR | CL)
 * @returns          InvoiceRecord with all fiscal identifiers
 */
export async function emitFiscalReceipt(
    order: Pick<Order, "id" | "total" | "user_id">,
    userEmail: string,
    taxRegion: TaxRegion
): Promise<InvoiceRecord> {
    const taxRate = TAX_RATES[taxRegion];
    const subtotal = Math.round((order.total / (1 + taxRate)) * 100) / 100;
    const taxAmount = Math.round(order.total - subtotal * 100) / 100;
    const issuedAt = new Date().toISOString();

    const payload: ProviderPayload = {
        reference_id: order.id,
        customer_email: userEmail,
        subtotal,
        tax_amount: taxAmount,
        total: order.total,
        tax_region: taxRegion,
        description: `Servicios de fitness – Orden ${order.id}`,
        issued_at: issuedAt,
    };

    // In development / no webhook configured: return a mock issued invoice
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
        return buildMockInvoice(order, userEmail, taxRegion, subtotal, taxAmount, issuedAt);
    }

    // ── Production: call regional provider ───────────────────────
    let providerResponse: ProviderResponse;
    try {
        const res = await fetch(TAX_WEBHOOK_URLS[taxRegion], {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.TAX_PROVIDER_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`Provider HTTP ${res.status}: ${await res.text()}`);
        }
        providerResponse = (await res.json()) as ProviderResponse;
    } catch (err) {
        console.error("[tax.service] Fiscal emission failed:", err);
        return buildErrorInvoice(order, userEmail, taxRegion, subtotal, taxAmount);
    }

    // ── Map provider response → InvoiceRecord ────────────────────
    return {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: order.user_id,
        tax_region: taxRegion,
        status: providerResponse.success ? "issued" : "error",
        cfdi_uuid: taxRegion === "MX" ? (providerResponse.uuid ?? null) : null,
        afip_cae: taxRegion === "AR" ? (providerResponse.cae ?? null) : null,
        sii_folio: taxRegion === "CL" ? (providerResponse.folio ?? null) : null,
        subtotal,
        tax_amount: taxAmount,
        total: order.total,
        pdf_url: providerResponse.pdf_url ?? null,
        xml_url: providerResponse.xml_url ?? null,
        issued_at: providerResponse.success ? issuedAt : null,
        created_at: issuedAt,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildMockInvoice(
    order: Pick<Order, "id" | "total" | "user_id">,
    _email: string,
    taxRegion: TaxRegion,
    subtotal: number,
    taxAmount: number,
    issuedAt: string
): InvoiceRecord {
    const fakeUUID = crypto.randomUUID().toUpperCase();
    return {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: order.user_id,
        tax_region: taxRegion,
        status: "issued",
        cfdi_uuid: taxRegion === "MX" ? fakeUUID : null,
        afip_cae: taxRegion === "AR" ? `CAE-${Date.now()}` : null,
        sii_folio: taxRegion === "CL" ? `F-${Date.now()}` : null,
        subtotal,
        tax_amount: taxAmount,
        total: order.total,
        pdf_url: `/api/invoices/${order.id}/pdf`,
        xml_url: taxRegion === "MX" ? `/api/invoices/${order.id}/xml` : null,
        issued_at: issuedAt,
        created_at: issuedAt,
    };
}

function buildErrorInvoice(
    order: Pick<Order, "id" | "total" | "user_id">,
    _email: string,
    taxRegion: TaxRegion,
    subtotal: number,
    taxAmount: number
): InvoiceRecord {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: order.user_id,
        tax_region: taxRegion,
        status: "error",
        cfdi_uuid: null, afip_cae: null, sii_folio: null,
        subtotal, tax_amount: taxAmount, total: order.total,
        pdf_url: null, xml_url: null, issued_at: null,
        created_at: now,
    };
}
