// app/hooks/useFeatureGate.ts
// ─────────────────────────────────────────────────────────────────────────────
// React hook that checks if a feature is available for the current gym's plan.
// Used to render UpgradePrompt components where a feature is locked.
//
// Usage:
//   const gate = useFeatureGate("crm_enabled");
//   if (!gate.enabled) return <UpgradePrompt {...gate} />;
// ─────────────────────────────────────────────────────────────────────────────

import { usePlanId, usePlanLimits, type PlanId, type PlanLimits } from "~/hooks/usePlanId";

export type FeatureKey = keyof Pick<
  PlanLimits,
  | "api_enabled"
  | "export_enabled"
  | "whatsapp_enabled"
  | "crm_enabled"
  | "fitcoins_enabled"
  | "cfdi_enabled"
>;

export interface FeatureGateResult {
  enabled:        boolean;
  planId:         PlanId;          // current plan
  planRequired:   PlanId;          // minimum plan to unlock
  planLabel:      string;          // "Pro", "Elite", etc.
  featureName:    string;          // Human-readable feature name
  upgradeMessage: string;          // Why to upgrade
  upgradeUrl:     string;          // CTA link
}

const PLAN_ORDER: PlanId[] = ["emprendedor", "starter", "pro", "elite"];

const PLAN_LABELS: Record<PlanId, string> = {
  emprendedor: "Emprendedor",
  starter:     "Starter",
  pro:         "Pro",
  elite:       "Elite",
};

// Minimum plan required per feature
const FEATURE_MIN_PLAN: Record<FeatureKey, PlanId> = {
  api_enabled:      "pro",
  export_enabled:   "starter",
  whatsapp_enabled: "pro",
  crm_enabled:      "pro",
  fitcoins_enabled: "pro",
  cfdi_enabled:     "elite",
};

// Human-readable names and upgrade messages
const FEATURE_META: Record<FeatureKey, { name: string; message: string }> = {
  api_enabled: {
    name:    "API Pública",
    message: "Integra Project Studio con tus sistemas externos mediante API REST.",
  },
  export_enabled: {
    name:    "Exportar datos",
    message: "Descarga tus alumnos, reservas y ventas en CSV o Excel.",
  },
  whatsapp_enabled: {
    name:    "Notificaciones por WhatsApp",
    message: "Envía recordatorios de clase y confirmaciones automáticas por WhatsApp.",
  },
  crm_enabled: {
    name:    "CRM de Leads",
    message: "Convierte más leads en socios con seguimiento automatizado.",
  },
  fitcoins_enabled: {
    name:    "FitCoins (gamificación)",
    message: "Aumenta la retención con un sistema de puntos y recompensas.",
  },
  cfdi_enabled: {
    name:    "Facturación CFDI automática",
    message: "Genera facturas CFDI con un click. Diferenciador exclusivo en LATAM.",
  },
};

/**
 * Returns whether a feature is available and upgrade info if not.
 */
export function useFeatureGate(feature: FeatureKey): FeatureGateResult {
  const planId  = usePlanId();
  const limits  = usePlanLimits();
  const enabled = limits[feature] as boolean;

  const planRequired = FEATURE_MIN_PLAN[feature];
  const meta         = FEATURE_META[feature];

  return {
    enabled,
    planId,
    planRequired,
    planLabel:      PLAN_LABELS[planRequired],
    featureName:    meta.name,
    upgradeMessage: meta.message,
    upgradeUrl:     `/admin/billing/upgrade?from=${feature}&plan=${planRequired}`,
  };
}

/**
 * Returns whether the current plan has a higher or equal rank to the required plan.
 * Useful for conditional rendering without going through the full gate.
 */
export function usePlanAtLeast(requiredPlan: PlanId): boolean {
  const planId = usePlanId();
  return PLAN_ORDER.indexOf(planId) >= PLAN_ORDER.indexOf(requiredPlan);
}
