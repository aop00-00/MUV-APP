// app/services/vercel-domains.server.ts
// Registers and removes custom domains on Vercel via their REST API.
// Requires VERCEL_API_TOKEN and VERCEL_PROJECT_ID env vars.

const VERCEL_API = "https://api.vercel.com";

function headers() {
    const token = process.env.VERCEL_API_TOKEN;
    if (!token) throw new Error("VERCEL_API_TOKEN no configurado");
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

function projectId() {
    const id = process.env.VERCEL_PROJECT_ID;
    if (!id) throw new Error("VERCEL_PROJECT_ID no configurado");
    return id;
}

export type DomainResult =
    | { ok: true; alreadyExists?: boolean }
    | { ok: false; error: string; code?: string };

/**
 * Adds a custom domain to the Vercel project.
 * Vercel handles SSL provisioning automatically after this call.
 */
export async function addDomainToVercel(domain: string): Promise<DomainResult> {
    const teamId = process.env.VERCEL_TEAM_ID; // optional, only for team accounts
    const url = teamId
        ? `${VERCEL_API}/v10/projects/${projectId()}/domains?teamId=${teamId}`
        : `${VERCEL_API}/v10/projects/${projectId()}/domains`;

    const res = await fetch(url, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: domain }),
    });

    const data = await res.json() as any;

    if (res.ok) return { ok: true };

    // Domain already added to this project — not a real error
    if (data?.error?.code === "domain_already_in_use" || res.status === 409) {
        return { ok: true, alreadyExists: true };
    }

    return {
        ok: false,
        error: data?.error?.message || `Vercel API error ${res.status}`,
        code: data?.error?.code,
    };
}

/**
 * Removes a custom domain from the Vercel project.
 * Called when the admin clears the custom domain field.
 */
export async function removeDomainFromVercel(domain: string): Promise<DomainResult> {
    const teamId = process.env.VERCEL_TEAM_ID;
    const url = teamId
        ? `${VERCEL_API}/v10/projects/${projectId()}/domains/${domain}?teamId=${teamId}`
        : `${VERCEL_API}/v10/projects/${projectId()}/domains/${domain}`;

    const res = await fetch(url, {
        method: "DELETE",
        headers: headers(),
    });

    if (res.ok || res.status === 404) return { ok: true };

    const data = await res.json() as any;
    return {
        ok: false,
        error: data?.error?.message || `Vercel API error ${res.status}`,
        code: data?.error?.code,
    };
}

/**
 * Checks the verification status of a domain on Vercel.
 * Returns the DNS records the client needs to configure.
 */
export async function getDomainStatus(domain: string): Promise<{
    verified: boolean;
    configured: boolean;
    cname?: string;
    aRecords?: string[];
    error?: string;
}> {
    const teamId = process.env.VERCEL_TEAM_ID;
    const url = teamId
        ? `${VERCEL_API}/v10/projects/${projectId()}/domains/${domain}?teamId=${teamId}`
        : `${VERCEL_API}/v10/projects/${projectId()}/domains/${domain}`;

    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return { verified: false, configured: false, error: `Domain not found` };

    const data = await res.json() as any;

    return {
        verified: data.verified === true,
        configured: data.verified === true,
        cname: "cname.vercel-dns.com",
        aRecords: ["76.76.21.21"],
    };
}
