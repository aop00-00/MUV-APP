// app/config/plan-features.ts
// Single source of truth for SaaS plan feature-gating.
// Maps each plan (emprendedor/starter/pro/elite) to the admin routes it can access.
// Resource limits here are mirrored from get_plan_limits() in the Supabase DB.
// Update BOTH when changing limits.

export type PlanId = "emprendedor" | "starter" | "pro" | "elite";

export interface PlanDefinition {
    label:         string;
    allowedRoutes: Set<string>;
    allRoutes?:    boolean;
    // ── Resource limits (null = unlimited) ──────────────────────────
    maxLocations:  number | null;
    maxMembers:    number | null;
    maxCoaches?:   number | null;   // null = unlimited
    maxPosProducts?: number | null; // null = unlimited
    maxClassTypes?: number | null;  // null = unlimited
    // ── Feature flags ────────────────────────────────────────────────
    apiEnabled?:       boolean;
    exportEnabled?:    boolean;
    whatsappEnabled?:  boolean;
    crmEnabled?:       boolean;
    fitcoinsEnabled?:  boolean;
    cfdiEnabled?:      boolean;
    stravaEnabled?:    boolean;
    reportHistoryDays?: number | null; // null = unlimited
}

const EMPRENDEDOR_ROUTES = new Set([
    "/admin",
    "/admin/schedule",
    "/admin/horarios",
    "/admin/reservas",
    "/admin/users",
    "/admin/subscriptions",
    "/admin/finance",
    "/admin/planes",
    "/admin/pos",
    "/admin/studio",
    "/admin/ubicaciones",
    "/admin/coaches",
    "/admin/pagos",
]);

const STARTER_ROUTES = new Set([
    "/admin",
    "/admin/schedule",
    "/admin/horarios",
    "/admin/periodos",
    "/admin/sustituciones",
    "/admin/reservas",
    "/admin/users",
    "/admin/subscriptions",
    "/admin/finance",
    "/admin/planes",
    "/admin/pos",
    "/admin/studio",
    "/admin/ubicaciones",
    "/admin/coaches",
    "/admin/pagos",
]);

const PRO_ROUTES = new Set([
    ...STARTER_ROUTES,
    "/admin/events",
    "/admin/crm",
    "/admin/cupones",
    "/admin/ingresos",
    "/admin/nomina",
    "/admin/operaciones",
]);

const ALL_ROUTES = new Set([
    ...PRO_ROUTES,
]);

export const PLAN_FEATURES: Record<PlanId, PlanDefinition> = {
    emprendedor: {
        label:            "Emprendedor",
        allowedRoutes:    EMPRENDEDOR_ROUTES,
        maxLocations:     1,
        maxMembers:       10,
        maxCoaches:       1,
        maxPosProducts:   5,
        maxClassTypes:    3,
        reportHistoryDays: 30,
        apiEnabled:       false,
        exportEnabled:    false,
        whatsappEnabled:  false,
        crmEnabled:       false,
        fitcoinsEnabled:  false,
        cfdiEnabled:      false,
        stravaEnabled:    false,
    },
    starter: {
        label:          "Starter",
        allowedRoutes:  STARTER_ROUTES,
        maxLocations:   1,
        maxMembers:     80,
        maxCoaches:     null,
        maxPosProducts: null,
        maxClassTypes:  null,
        apiEnabled:     false,
        exportEnabled:  true,
        whatsappEnabled: false,
        crmEnabled:     false,
        fitcoinsEnabled: false,
        cfdiEnabled:    false,
        stravaEnabled:  false,
    },
    pro: {
        label:          "Pro",
        allowedRoutes:  PRO_ROUTES,
        maxLocations:   3,
        maxMembers:     300,
        maxCoaches:     null,
        maxPosProducts: null,
        maxClassTypes:  null,
        apiEnabled:     true,
        exportEnabled:  true,
        whatsappEnabled: true,
        crmEnabled:     true,
        fitcoinsEnabled: true,
        cfdiEnabled:    false,
        stravaEnabled:  true,
    },
    elite: {
        label:          "Elite",
        allowedRoutes:  ALL_ROUTES,
        allRoutes:      true,
        maxLocations:   null,
        maxMembers:     null,
        maxCoaches:     null,
        maxPosProducts: null,
        maxClassTypes:  null,
        apiEnabled:     true,
        exportEnabled:  true,
        whatsappEnabled: true,
        crmEnabled:     true,
        fitcoinsEnabled: true,
        cfdiEnabled:    true,
        stravaEnabled:  true,
    },
};

/** Check if a given admin href is allowed for a plan. */
export function isRouteAllowed(planId: PlanId, href: string): boolean {
    const plan = PLAN_FEATURES[planId];
    if (!plan) return false;
    if (plan.allRoutes) return true;
    return plan.allowedRoutes.has(href);
}

/** Returns the minimum plan required to access a route. */
export function getMinimumPlanForRoute(href: string): PlanId {
    if (EMPRENDEDOR_ROUTES.has(href)) return "emprendedor";
    if (STARTER_ROUTES.has(href)) return "starter";
    if (PRO_ROUTES.has(href)) return "pro";
    return "elite";
}

