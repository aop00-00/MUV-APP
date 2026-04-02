// app/services/subdomain.server.ts
// Extracts the tenant subdomain from the incoming request.
// e.g. "estudio.projectstudio.app" → "estudio"
//      "projectstudio.app"         → null

const APP_DOMAIN = process.env.APP_DOMAIN || "projectstudio.app";

/**
 * Returns the subdomain slug from the request, or null if on the main domain.
 *
 * In local dev, supports ?subdomain=xxx query param for testing without DNS.
 */
export function getSubdomain(request: Request): string | null {
    const url = new URL(request.url);
    const host = url.hostname; // e.g. "estudio.grindproject.com"

    // Local dev: ?subdomain=estudio override
    if (process.env.NODE_ENV !== "production") {
        const debug = url.searchParams.get("subdomain");
        if (debug) return debug.toLowerCase().trim();
    }

    // Bare localhost / 127.0.0.1 → no subdomain
    if (host === "localhost" || host === "127.0.0.1") return null;

    // Vercel preview domains (*.vercel.app) → treat as main
    if (host.endsWith(".vercel.app")) return null;

    // Main domain exact match
    if (host === APP_DOMAIN || host === `www.${APP_DOMAIN}`) return null;

    // Extract subdomain: "estudio.grindproject.com" → "estudio"
    const suffix = `.${APP_DOMAIN}`;
    if (host.endsWith(suffix)) {
        const sub = host.slice(0, -suffix.length);
        if (!sub || sub === "www") return null;
        return sub.toLowerCase();
    }

    // Handle "estudio.localhost" for local dev with /etc/hosts or dnsmasq
    const parts = host.split(".");
    if (parts.length === 2 && parts[1] === "localhost") {
        return parts[0].toLowerCase();
    }

    return null;
}
