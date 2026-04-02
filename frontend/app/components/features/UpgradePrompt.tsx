// app/components/features/UpgradePrompt.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Inline upgrade prompt for locked features.
// Replaces the blocked UI with a blur preview + CTA — NOT a modal.
//
// Usage:
//   const gate = useFeatureGate("crm_enabled");
//   if (!gate.enabled) {
//     return (
//       <UpgradePrompt
//         featureName={gate.featureName}
//         planRequired={gate.planRequired}
//         message={gate.upgradeMessage}
//         ctaHref={gate.upgradeUrl}
//       />
//     );
//   }
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import { Link } from "react-router";
import type { PlanId } from "~/hooks/usePlanId";

export interface UpgradePromptProps {
  /** Human-readable feature name, e.g. "CRM de Leads" */
  featureName: string;
  /** Minimum plan to unlock, e.g. "pro" */
  planRequired: PlanId;
  /** Main benefit message shown to the user */
  message: string;
  /** Visual variant: blur shows children with blur overlay, locked shows lock icon, counter shows usage bar */
  previewType?: "blur" | "locked" | "counter";
  /** Custom CTA button text */
  ctaText?: string;
  /** URL of the upgrade page */
  ctaHref?: string;
  /** Children to show blurred (only for previewType="blur") */
  children?: React.ReactNode;
  /** Current usage count (only for previewType="counter") */
  currentCount?: number;
  /** Maximum allowed count (only for previewType="counter") */
  maxCount?: number;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

const PLAN_LABELS: Record<PlanId, string> = {
  emprendedor: "Emprendedor",
  starter:     "Starter",
  pro:         "Pro",
  elite:       "Elite",
};

const PLAN_COLORS: Record<PlanId, { badge: string; button: string; glow: string }> = {
  emprendedor: {
    badge:  "bg-slate-500/20 text-slate-300 border-slate-500/30",
    button: "bg-slate-600 hover:bg-slate-500",
    glow:   "shadow-slate-500/20",
  },
  starter: {
    badge:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
    button: "bg-blue-600 hover:bg-blue-500",
    glow:   "shadow-blue-500/20",
  },
  pro: {
    badge:  "bg-violet-500/20 text-violet-300 border-violet-500/30",
    button: "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500",
    glow:   "shadow-violet-500/30",
  },
  elite: {
    badge:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
    button: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
    glow:   "shadow-amber-500/30",
  },
};

// ─── Plan icon glyphs ─────────────────────────────────────────────────────────
const PlanIcon = ({ plan }: { plan: PlanId }) => {
  const icons: Record<PlanId, string> = {
    emprendedor: "🌱",
    starter:     "🚀",
    pro:         "⚡",
    elite:       "👑",
  };
  return <span className="text-base leading-none">{icons[plan]}</span>;
};

// ─── Lock icon ────────────────────────────────────────────────────────────────
const LockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
      clipRule="evenodd"
    />
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────

export function UpgradePrompt({
  featureName,
  planRequired,
  message,
  previewType = "locked",
  ctaText,
  ctaHref = "/admin/billing/upgrade",
  children,
  currentCount,
  maxCount,
  className = "",
}: UpgradePromptProps) {
  const colors    = PLAN_COLORS[planRequired];
  const planLabel = PLAN_LABELS[planRequired];
  const buttonText = ctaText ?? `Desbloquear con ${planLabel}`;

  // Usage percentage for counter variant
  const usagePct = (currentCount !== undefined && maxCount !== undefined && maxCount > 0)
    ? Math.min(100, Math.round((currentCount / maxCount) * 100))
    : 0;

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`}>

      {/* ── Blur variant: show children underneath a frosted overlay ─── */}
      {previewType === "blur" && children && (
        <div className="relative">
          <div className="pointer-events-none select-none blur-sm opacity-40 saturate-50">
            {children}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/50 to-gray-900/90" />
        </div>
      )}

      {/* ── Core card ─── */}
      <div
        className={`
          relative z-10 flex flex-col items-center justify-center gap-5 p-8
          bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-2xl
          text-center transition-all duration-300
          shadow-2xl ${colors.glow}
          ${previewType === "blur" ? "absolute inset-0" : "min-h-[200px]"}
        `}
      >
        {/* Lock / plan icon */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/5 border border-white/10">
            {previewType === "locked" ? (
              <span className="text-white/50">
                <LockIcon />
              </span>
            ) : (
              <PlanIcon plan={planRequired} />
            )}
          </div>

          {/* Plan badge */}
          <span
            className={`
              inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
              border ${colors.badge}
            `}
          >
            <PlanIcon plan={planRequired} />
            Plan {planLabel}
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2 max-w-sm">
          <h3 className="text-white font-semibold text-lg leading-snug">
            {featureName}
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            {message}
          </p>
        </div>

        {/* Counter bar (only for counter variant) */}
        {previewType === "counter" && maxCount !== undefined && currentCount !== undefined && (
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{currentCount} / {maxCount}</span>
              <span>{usagePct}% usado</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Límite del plan {PLAN_LABELS["emprendedor"]}
            </p>
          </div>
        )}

        {/* CTA button */}
        <Link
          to={ctaHref}
          className={`
            inline-flex items-center gap-2 px-6 py-2.5 rounded-xl
            text-white text-sm font-semibold
            transition-all duration-200 active:scale-95
            shadow-lg ${colors.button} ${colors.glow}
          `}
        >
          <PlanIcon plan={planRequired} />
          {buttonText}
        </Link>

        {/* Subtle secondary link */}
        <p className="text-xs text-gray-600">
          Ver todos los{" "}
          <Link
            to="/admin/billing/upgrade"
            className="text-gray-400 hover:text-white underline transition-colors"
          >
            planes disponibles
          </Link>
        </p>
      </div>
    </div>
  );
}

export default UpgradePrompt;
