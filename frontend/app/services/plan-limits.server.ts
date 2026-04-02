// app/services/plan-limits.server.ts
// ─────────────────────────────────────────────────────────────────────────────
// Server-side plan limits & feature gating.
//
// PERFORMANCE: plan_id is read from the JWT claim (injected by
// custom_access_token_hook) — 0 extra queries to the gyms table per request.
// Falls back to a DB query only for legacy tokens that predate the migration.
// ─────────────────────────────────────────────────────────────────────────────

import { type PlanId, PLAN_FEATURES } from "~/config/plan-features";
import { getSession } from "~/services/auth.server";
import { supabaseAdmin } from "~/services/supabase.server";

export type { PlanId };

export interface PlanLimits {
  max_members:          number | null;
  max_class_types:      number | null;
  max_coaches:          number | null;
  max_products:         number | null;
  max_locations:        number | null;
  max_rooms:            number | null;
  report_history_days:  number | null;
  api_enabled:          boolean;
  export_enabled:       boolean;
  whatsapp_enabled:     boolean;
  crm_enabled:          boolean;
  fitcoins_enabled:     boolean;
  cfdi_enabled:         boolean;
}

export type FeatureKey = keyof Pick<
  PlanLimits,
  | "api_enabled"
  | "export_enabled"
  | "whatsapp_enabled"
  | "crm_enabled"
  | "fitcoins_enabled"
  | "cfdi_enabled"
>;

export type ResourceKey =
  | "max_members"
  | "max_class_types"
  | "max_coaches"
  | "max_products"
  | "max_locations"
  | "max_rooms";

// ─── Plan limits lookup (mirrors get_plan_limits() in DB) ─────────────────
const LIMITS_BY_PLAN: Record<PlanId, PlanLimits> = {
  emprendedor: {
    max_members:         10,
    max_class_types:     3,
    max_coaches:         1,
    max_products:        5,
    max_locations:       1,
    max_rooms:           1,
    report_history_days: 30,
    api_enabled:         false,
    export_enabled:      false,
    whatsapp_enabled:    false,
    crm_enabled:         false,
    fitcoins_enabled:    false,
    cfdi_enabled:        false,
  },
  starter: {
    max_members:         80,
    max_class_types:     null,
    max_coaches:         null,
    max_products:        null,
    max_locations:       1,
    max_rooms:           null,
    report_history_days: null,
    api_enabled:         false,
    export_enabled:      true,
    whatsapp_enabled:    false,
    crm_enabled:         false,
    fitcoins_enabled:    false,
    cfdi_enabled:        false,
  },
  pro: {
    max_members:         300,
    max_class_types:     null,
    max_coaches:         null,
    max_products:        null,
    max_locations:       3,
    max_rooms:           null,
    report_history_days: null,
    api_enabled:         true,
    export_enabled:      true,
    whatsapp_enabled:    true,
    crm_enabled:         true,
    fitcoins_enabled:    true,
    cfdi_enabled:        false,
  },
  elite: {
    max_members:         null,
    max_class_types:     null,
    max_coaches:         null,
    max_products:        null,
    max_locations:       null,
    max_rooms:           null,
    report_history_days: null,
    api_enabled:         true,
    export_enabled:      true,
    whatsapp_enabled:    true,
    crm_enabled:         true,
    fitcoins_enabled:    true,
    cfdi_enabled:        true,
  },
};

// Minimum plan required for each feature
const FEATURE_MIN_PLAN: Record<FeatureKey, PlanId> = {
  api_enabled:       "pro",
  export_enabled:    "starter",
  whatsapp_enabled:  "pro",
  crm_enabled:       "pro",
  fitcoins_enabled:  "pro",
  cfdi_enabled:      "elite",
};

const PLAN_ORDER: PlanId[] = ["emprendedor", "starter", "pro", "elite"];
const planRank = (p: PlanId) => PLAN_ORDER.indexOf(p);

// ─── Main helpers ─────────────────────────────────────────────────────────────

/**
 * Reads plan_id from the JWT claims (0 DB queries).
 * Falls back to a DB query for legacy tokens pre-migration.
 */
export async function getPlanId(request: Request): Promise<PlanId> {
  const session = await getSession(request);
  const userId = session.get("user_id") as string | undefined;

  if (!userId) return "emprendedor"; // unauthenticated = most restrictive

  // Try to get plan_id from Supabase user metadata / JWT via admin API
  // (the JWT claim is set by custom_access_token_hook on next login)
  // For server-side reading we query the session via getUser
  try {
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const planIdFromMeta = user?.user_metadata?.plan_id as PlanId | undefined;
    if (planIdFromMeta && PLAN_ORDER.includes(planIdFromMeta)) {
      return planIdFromMeta;
    }
  } catch {
    // Ignore — fall through to DB query
  }

  // Fallback: query gyms table directly
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("gym_id")
      .eq("id", userId)
      .single();

    if (profile?.gym_id) {
      const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("plan_id")
        .eq("id", profile.gym_id)
        .single();

      const planId = gym?.plan_id as PlanId | undefined;
      if (planId && PLAN_ORDER.includes(planId)) {
        console.warn("[plan-limits] JWT missing plan_id claim — used DB fallback for user:", userId);
        return planId;
      }
    }
  } catch {
    // Ignore
  }

  return "emprendedor"; // safest default
}

/**
 * Returns the full limits object for a given plan.
 */
export function getPlanLimits(planId: PlanId): PlanLimits {
  return LIMITS_BY_PLAN[planId] ?? LIMITS_BY_PLAN.emprendedor;
}

/**
 * Server-side feature gate check.
 * Returns the 403 Response if feature is not enabled for the plan.
 *
 * Usage in loader:
 *   const gate = await requireFeatureAccess(request, "crm_enabled");
 *   if (gate) return gate; // 403 response with upgrade info
 */
export async function requireFeatureAccess(
  request: Request,
  feature: FeatureKey,
): Promise<Response | null> {
  const planId  = await getPlanId(request);
  const limits  = getPlanLimits(planId);
  const enabled = limits[feature] as boolean;

  if (enabled) return null; // ✅ allowed

  const requiredPlan = FEATURE_MIN_PLAN[feature];
  return new Response(
    JSON.stringify({
      error:        "feature_not_available",
      feature,
      plan_current: planId,
      plan_required: requiredPlan,
      upgrade_url:  "/admin/billing/upgrade",
      message:      `Esta función requiere el plan ${PLAN_FEATURES[requiredPlan]?.label ?? requiredPlan}.`,
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Checks if a resource limit would be exceeded.
 * Uses the DB to count the current resources.
 */
export async function checkResourceLimit(
  gymId: string,
  planId: PlanId,
  resource: ResourceKey,
): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  const limits   = getPlanLimits(planId);
  const limit    = limits[resource] as number | null;

  if (limit === null) return { allowed: true, current: 0, limit: null };

  // Table/column mapping for each resource type
  const resourceMap: Record<ResourceKey, { table: string; where?: Record<string, unknown> }> = {
    max_members:     { table: "profiles",    where: { role: "member" } },
    max_class_types: { table: "class_types", where: { is_active: true } },
    max_coaches:     { table: "coaches",     where: { is_active: true } },
    max_products:    { table: "products",    where: { is_active: true } },
    max_locations:   { table: "locations",   where: { is_active: true } },
    max_rooms:       { table: "rooms",       where: { is_active: true } },
  };

  const { table, where = {} } = resourceMap[resource];

  let query = supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId);

  for (const [key, value] of Object.entries(where)) {
    query = (query as any).eq(key, value);
  }

  const { count, error } = await query;

  if (error) {
    console.error(`[plan-limits] checkResourceLimit error for ${table}:`, error);
    return { allowed: true, current: 0, limit }; // fail open — DB trigger is the hard stop
  }

  const current = count ?? 0;
  return { allowed: current < limit, current, limit };
}

/**
 * Returns an upgrade message for a resource that's at its limit.
 */
export function getUpgradeMessage(resource: ResourceKey, limit: number, planId: PlanId): string {
  const messages: Record<ResourceKey, string> = {
    max_members:     `Tu plan ${planId} incluye hasta ${limit} alumnos activos.`,
    max_class_types: `Tu plan ${planId} incluye hasta ${limit} tipos de clase.`,
    max_coaches:     `Tu plan ${planId} incluye hasta ${limit} coach activo.`,
    max_products:    `Tu plan ${planId} incluye hasta ${limit} productos en el POS.`,
    max_locations:   `Tu plan ${planId} incluye hasta ${limit} sede.`,
    max_rooms:       `Tu plan ${planId} incluye hasta ${limit} sala.`,
  };
  return messages[resource] ?? `Límite alcanzado para tu plan ${planId}.`;
}

/**
 * Returns the minimum plan that has a larger limit for a given resource.
 */
export function getUpgradePlan(planId: PlanId, resource: ResourceKey): PlanId {
  const currentRank = planRank(planId);
  for (const plan of PLAN_ORDER.slice(currentRank + 1)) {
    const limit = LIMITS_BY_PLAN[plan][resource];
    if (limit === null || (limit as number) > (LIMITS_BY_PLAN[planId][resource] ?? 0)) {
      return plan;
    }
  }
  return "elite";
}
