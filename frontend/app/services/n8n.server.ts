// app/services/n8n.server.ts
/**
 * Utility to trigger n8n webhooks from the frontend server-side logic.
 * Ensures consistent payload format and handling.
 */

const N8N_BASE_URL = process.env.N8N_BASE_URL || "https://aop00.app.n8n.cloud";
const USE_TEST_WEBHOOK = process.env.N8N_USE_TEST_WEBHOOK === "true";

export type WebhookTrigger = "payment" | "booking" | "class_completed" | "qr_scan" | "onboarding" | "gym_created";

interface TriggerOptions {
    userId?: string;
    gymId?: string;
    trigger: WebhookTrigger;
    data?: any;
}

/**
 * Sends a POST request to an n8n webhook tunnel.
 * @param path - The webhook path defined in n8n (e.g., 'grind-user-stats')
 * @param payload - The data to send
 */
async function callWebhook(path: string, payload: any) {
    try {
        const webhookType = USE_TEST_WEBHOOK ? "webhook-test" : "webhook";
        const url = `${N8N_BASE_URL}/${webhookType}/${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`[n8n.server] Failed to trigger ${path}: ${response.statusText}`);
            return { success: false, status: response.status };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error(`[n8n.server] Error calling n8n:`, error);
        return { success: false, error };
    }
}

/**
 * Triggers WF — New Studio Onboarding
 */
export async function triggerOnboarding(gymId: string, ownerId: string, details: any) {
    return callWebhook("grind-onboarding", {
        gym_id: gymId,
        owner_id: ownerId,
        ...details,
        event: "gym_created",
        timestamp: new Date().toISOString()
    });
}

/**
 * Triggers WF6 — Admin Stats Snapshot
 */
export async function triggerAdminStatsUpdate(gymId: string) {
    return callWebhook("grind-admin-stats", { gymId });
}

/**
 * Triggers WF11 — User Stats Snapshot
 */
export async function triggerUserStatsUpdate(userId: string, gymId: string, trigger: WebhookTrigger) {
    return callWebhook("grind-user-stats", { userId, gymId, trigger });
}

/**
 * Triggers WF3 — QR Access Logger
 */
export async function triggerQRAccessLog(userId: string, gymId: string, status: "allowed" | "denied", reason?: string) {
    return callWebhook("grind-qr-access", {
        userId,
        gym_id: gymId, // Using snake_case as expected by SQL-based nodes in n8n
        status,
        reason,
        scanned_at: new Date().toISOString()
    });
}

/**
 * Triggers Inactivity / Abuse Emails
 */
export async function triggerInactivityEmail(gymId: string, phase: "warning" | "archived" | "soft_delete", daysInactive: number) {
    return callWebhook("grind-gym-inactivity", {
        gymId,
        phase,
        daysInactive,
        timestamp: new Date().toISOString()
    });
}
