import { useNavigate } from "react-router";
import type { PlanTier } from "./gates.server";

const PLAN_NAMES: Record<PlanTier, string> = {
  FREE: "Free",
  STARTER: "Starter",
  GROWTH: "Growth",
  SCALE: "Scale",
};

const PLAN_PRICES: Record<PlanTier, string> = {
  FREE: "0€",
  STARTER: "14,90€",
  GROWTH: "49,90€",
  SCALE: "149,90€",
};

const PLAN_COLORS: Record<PlanTier, { color: string; bg: string; border: string }> = {
  FREE: { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
  STARTER: { color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd" },
  GROWTH: { color: "#166534", bg: "#dcfce7", border: "#86efac" },
  SCALE: { color: "#92400e", bg: "#fef3c7", border: "#fde68a" },
};

/**
 * Full-page gate — replaces the page content when the user doesn't have access.
 */
export function UpgradeGate({
  featureLabel,
  requiredPlan,
  currentPlan,
  children,
}: {
  featureLabel: string;
  requiredPlan: PlanTier;
  currentPlan: PlanTier;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const cfg = PLAN_COLORS[requiredPlan];

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "64px 24px", textAlign: "center",
      minHeight: 400,
    }}>
      {/* Lock icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 20,
      }}>
        🔒
      </div>

      {/* Title */}
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1612", marginBottom: 8 }}>
        {featureLabel}
      </div>

      {/* Description */}
      <div style={{ fontSize: 14, color: "#7d756c", marginBottom: 6, maxWidth: 400, lineHeight: 1.5 }}>
        Cette fonctionnalité est disponible à partir du plan
      </div>

      {/* Plan badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 20px", borderRadius: 12,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: cfg.color }}>
          {PLAN_NAMES[requiredPlan]}
        </span>
        <span style={{ fontSize: 13, color: cfg.color, opacity: 0.7 }}>
          {PLAN_PRICES[requiredPlan]}/mois
        </span>
      </div>

      {/* Current plan info */}
      <div style={{ fontSize: 12, color: "#a09890", marginBottom: 20 }}>
        Votre plan actuel : <strong>{PLAN_NAMES[currentPlan]}</strong>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate("/app/pricing")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "11px 28px", borderRadius: 10,
          background: "#1a1612", color: "#fdfcfb",
          fontSize: 14, fontWeight: 600, border: "none",
          cursor: "pointer", boxShadow: "0 2px 8px rgba(26,22,18,.2)",
          transition: "all 0.15s ease", fontFamily: "inherit",
        }}
      >
        Voir les plans →
      </button>

      {/* Optional preview content (blurred) */}
      {children && (
        <div style={{
          marginTop: 32, width: "100%", maxWidth: 800,
          filter: "blur(6px)", opacity: 0.4, pointerEvents: "none",
          userSelect: "none",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Inline badge for locked features in navigation/cards.
 */
export function PlanBadge({ plan }: { plan: PlanTier }) {
  const cfg = PLAN_COLORS[plan];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {PLAN_NAMES[plan]}
    </span>
  );
}
