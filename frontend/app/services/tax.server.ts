// app/services/tax.server.ts
// Fiscal receipt emission — CFDI 4.0 (Mexico) only for now.
// AR (AFIP) and CL (SII) support will be added in a future phase.

import type { Order } from "~/types/database";
import type { InvoiceRecord, TaxRegion } from "~/types/database";

// ─── Configuration ────────────────────────────────────────────────
const CFDI_WEBHOOK_URL = process.env.CFDI_WEBHOOK_URL ?? "https://api.fiscalprovider.mx/cfdi/emit";

// IVA rate for Mexico
const MX_TAX_RATE = 0.16;

// ─── Types ────────────────────────────────────────────────────────
interface CfdiPayload {
    reference_id: string;
    customer_email: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    tax_region: "MX";
    description: string;
    issued_at: string;
}

interface CfdiResponse {
    success: boolean;
    uuid?: string;         // CFDI UUID
    pdf_url?: string;
    xml_url?: string;
    error?: string;
}

// ─── Main Function ────────────────────────────────────────────────

/**
 * Emits a CFDI 4.0 fiscal receipt for an order (Mexico only).
 * Calls the CFDI provider webhook and returns a typed InvoiceRecord.
 *
 * @param order      - The paid order to invoice
 * @param userEmail  - Customer email for the receipt
 * @param taxRegion  - Must be "MX" for now; other regions throw an error
 * @returns          InvoiceRecord with CFDI identifiers
 */
export async function emitFiscalReceipt(
    order: Pick<Order, "id" | "total" | "user_id">,
    userEmail: string,
    taxRegion: TaxRegion
): Promise<InvoiceRecord> {
    if (taxRegion !== "MX") {
        throw new Error(
            `Tax region "${taxRegion}" is not yet supported. Only CFDI (MX) is available.`
        );
    }

    const subtotal = Math.round((order.total / (1 + MX_TAX_RATE)) * 100) / 100;
    const taxAmount = Math.round((order.total - subtotal) * 100) / 100;
    const issuedAt = new Date().toISOString();

    const payload: CfdiPayload = {
        reference_id: order.id,
        customer_email: userEmail,
        subtotal,
        tax_amount: taxAmount,
        total: order.total,
        tax_region: "MX",
        description: `Servicios de fitness – Orden ${order.id}`,
        issued_at: issuedAt,
    };

    // In development / no webhook configured: return a mock issued invoice
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
        return buildMockInvoice(order, subtotal, taxAmount, issuedAt);
    }

    // ── Production: call CFDI provider ─────────────────────────────
    let providerResponse: CfdiResponse;
    try {
        const res = await fetch(CFDI_WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.CFDI_PROVIDER_API_KEY}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`CFDI provider HTTP ${res.status}: ${await res.text()}`);
        }
        providerResponse = (await res.json()) as CfdiResponse;
    } catch (err) {
        console.error("[tax.server] CFDI emission failed:", err);
        return buildErrorInvoice(order, subtotal, taxAmount);
    }

    return {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: order.user_id || "",
        tax_region: "MX",
        status: providerResponse.success ? "issued" : "error",
        cfdi_uuid: providerResponse.uuid ?? null,
        afip_cae: null,
        sii_folio: null,
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
    subtotal: number,
    taxAmount: number,
    issuedAt: string
): InvoiceRecord {
    const fakeUUID = crypto.randomUUID().toUpperCase();
    return {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: order.user_id || "",
        tax_region: "MX",
        status: "issued",
        cfdi_uuid: fakeUUID,
        afip_cae: null,
        sii_folio: null,
        subtotal,
        tax_amount: taxAmount,
        total: order.total,
        pdf_url: `/api/invoices/${order.id}/pdf`,
        xml_url: `/api/invoices/${order.id}/xml`,
        issued_at: issuedAt,
        created_at: issuedAt,
    };
}

function buildErrorInvoice(
    order: Pick<Order, "id" | "total" | "user_id">,
    subtotal: number,
    taxAmount: number
): InvoiceRecord {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        order_id: order.id,
        user_id: order.user_id || "",
        tax_region: "MX",
        status: "error",
        cfdi_uuid: null, afip_cae: null, sii_folio: null,
        subtotal, tax_amount: taxAmount, total: order.total,
        pdf_url: null, xml_url: null, issued_at: null,
        created_at: now,
    };
}
