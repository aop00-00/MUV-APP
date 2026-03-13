// app/services/access.service.ts
// Physical access control via signed, time-limited QR tokens.
// Uses Web Crypto API (no extra dependencies) for HMAC-SHA256 signing.

import type { QRAccessToken, AccessLog, AccessType } from "~/types/database";

// ─── Configuration ────────────────────────────────────────────────
const QR_SECRET = process.env.QR_SECRET ?? "grind-qr-dev-secret-change-in-prod";
const QR_BASE_URL = process.env.APP_URL ?? "http://localhost:5173";

// ─── HMAC Helpers ─────────────────────────────────────────────────

async function sign(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(QR_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function verify(message: string, signature: string): Promise<boolean> {
    try {
        const expected = await sign(message);
        return expected === signature;
    } catch {
        return false;
    }
}

// ─── Token Structure ──────────────────────────────────────────────
// Format: base64( JSON({ userId, expiresAt }) ).SIGNATURE
function encodePayload(obj: object): string {
    return btoa(JSON.stringify(obj));
}

function decodePayload<T>(encoded: string): T {
    return JSON.parse(atob(encoded)) as T;
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Generates a signed, time-limited QR access token for a user.
 *
 * @param userId           - The user's profile ID
 * @param expiresInMinutes - Token validity window (default 30 min)
 * @returns QRAccessToken  - { qrUrl, token, expiresAt }
 */
export async function generateAccessQR(
    userId: string,
    expiresInMinutes = 30
): Promise<QRAccessToken> {
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    const payload = encodePayload({ userId, expiresAt });
    const signature = await sign(payload);
    const token = `${payload}.${signature}`;

    // In production this URL would be rendered as an actual QR image
    // via a QR-code API (e.g. https://api.qrserver.com/v1/create-qr-code/)
    const qrUrl = `${QR_BASE_URL}/api/access/validate?token=${encodeURIComponent(token)}`;

    return { qrUrl, token, expiresAt };
}

/**
 * Validates a QR token – checks HMAC signature and expiration.
 *
 * @param token - The raw token string from the QR scan
 * @returns { valid: boolean; userId?: string; reason?: string }
 */
export async function validateQRToken(
    token: string
): Promise<{ valid: boolean; userId?: string; reason?: string }> {
    try {
        const dotIndex = token.lastIndexOf(".");
        if (dotIndex === -1) return { valid: false, reason: "Formato inválido" };

        const payload = token.slice(0, dotIndex);
        const signature = token.slice(dotIndex + 1);

        const isValid = await verify(payload, signature);
        if (!isValid) return { valid: false, reason: "Firma inválida" };

        const decoded = decodePayload<{ userId: string; expiresAt: string }>(payload);

        if (new Date(decoded.expiresAt) < new Date()) {
            return { valid: false, reason: "Token expirado", userId: decoded.userId };
        }

        return { valid: true, userId: decoded.userId };
    } catch {
        return { valid: false, reason: "Error al procesar token" };
    }
}

import { triggerQRAccessLog } from "./n8n.server";

/**
 * Records an access entry/exit event.
 * Syncs with n8n for real-time logging and stats.
 *
 * @param userId - The user's profile ID
 * @param gymId  - The ID of the gym being accessed
 * @param type   - "entry" | "exit"
 * @param status - "allowed" | "denied"
 * @param reason - Optional reason if denied
 * @returns AccessLog record
 */
export async function logAccess(
    userId: string,
    gymId: string,
    type: AccessType,
    status: "allowed" | "denied" = "allowed",
    reason?: string
): Promise<AccessLog> {
    const log: AccessLog = {
        id: crypto.randomUUID(),
        user_id: userId,
        access_type: type,
        qr_token: null,
        validated: status === "allowed",
        created_at: new Date().toISOString(),
    };

    // Trigger n8n Background Workflow
    // We don't 'await' it to avoid blocking the UI response
    triggerQRAccessLog(userId, gymId, status, reason);

    console.info(`[access.service] ${type.toUpperCase()}:${status} — user:${userId} gym:${gymId}`);

    return log;
}
