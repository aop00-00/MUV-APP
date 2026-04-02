// app/hooks/usePlanId.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-side hook to read plan_id from the root loader context.
//
// The root loader already fetches the gym and passes tenant config.
// We piggyback on that to expose plan_id to all components without
// any additional network requests.
//
// plan_id is injected into the JWT by custom_access_token_hook and
// passed down through root loader data.
// ─────────────────────────────────────────────────────────────────────────────

import { useRouteLoaderData } from "react-router";
import type { PlanId, PlanLimits } from "~/services/plan-limits.server";
import { PLAN_FEATURES } from "~/config/plan-features";

// The root loader now exposes planId (set by gym.server or root loader update)
// Fallback to 'emprendedor' (most restrictive) if not available.

const VALID_PLANS: PlanId[] = ["emprendedor", "starter", "pro", "elite"];

/**
 * Returns the current gym's plan ID.
 * Reads from root loader data — 0 network requests.
 */
export function usePlanId(): PlanId {
  // Try from root loader data
  const rootData = useRouteLoaderData("root") as
    | { planId?: string; tenant?: { planId?: string } }
    | undefined;

  const rawPlan = rootData?.planId ?? rootData?.tenant?.planId;
  if (rawPlan && VALID_PLANS.includes(rawPlan as PlanId)) {
    return rawPlan as PlanId;
  }

  return "emprendedor"; // safest default
}

/**
 * Returns the plan limits object for the current gym's plan.
 */
export function usePlanLimits(): PlanLimits {
  const planId = usePlanId();
  return getPlanLimitsClient(planId);
}

// Mirror of server-side LIMITS_BY_PLAN for client use
// (kept in sync manually — single source of truth is the DB function)
const PLAN_LIMITS_CLIENT: Record<PlanId, PlanLimits> = {
  emprendedor: {
    max_members: 10, max_class_types: 3, max_coaches: 1,
    max_products: 5, max_locations: 1, max_rooms: 1,
    report_history_days: 30,
    api_enabled: false, export_enabled: false, whatsapp_enabled: false,
    crm_enabled: false, fitcoins_enabled: false, cfdi_enabled: false,
  },
  starter: {
    max_members: 80, max_class_types: null, max_coaches: null,
    max_products: null, max_locations: 1, max_rooms: null,
    report_history_days: null,
    api_enabled: false, export_enabled: true, whatsapp_enabled: false,
    crm_enabled: false, fitcoins_enabled: false, cfdi_enabled: false,
  },
  pro: {
    max_members: 300, max_class_types: null, max_coaches: null,
    max_products: null, max_locations: 3, max_rooms: null,
    report_history_days: null,
    api_enabled: true, export_enabled: true, whatsapp_enabled: true,
    crm_enabled: true, fitcoins_enabled: true, cfdi_enabled: false,
  },
  elite: {
    max_members: null, max_class_types: null, max_coaches: null,
    max_products: null, max_locations: null, max_rooms: null,
    report_history_days: null,
    api_enabled: true, export_enabled: true, whatsapp_enabled: true,
    crm_enabled: true, fitcoins_enabled: true, cfdi_enabled: true,
  },
};

// Re-export type for use in components
export type { PlanId, PlanLimits };

export function getPlanLimitsClient(planId: PlanId): PlanLimits {
  return PLAN_LIMITS_CLIENT[planId] ?? PLAN_LIMITS_CLIENT.emprendedor;
}

/**
 * Returns a boolean indicating if a feature is enabled for the current plan.
 */
export function useIsFeatureEnabled(
  feature: keyof Pick<
    PlanLimits,
    | "api_enabled"
    | "export_enabled"
    | "whatsapp_enabled"
    | "crm_enabled"
    | "fitcoins_enabled"
    | "cfdi_enabled"
  >,
): boolean {
  const limits = usePlanLimits();
  return limits[feature] as boolean;
}

/**
 * Returns the plan label for display purposes.
 */
export function usePlanLabel(): string {
  const planId = usePlanId();
  return PLAN_FEATURES[planId]?.label ?? planId;
}
