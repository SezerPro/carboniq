/**
 * Server-only plan helpers (can import Prisma etc.)
 * Re-exports client-safe constants from constants.ts
 */

export { type PlanTier, hasAccess, FEATURES, PLANS, FEATURES as default } from "./constants";
export type { FeatureGate, PlanInfo } from "./constants";

import type { PlanTier } from "./constants";
import { hasAccess, FEATURES, PLANS } from "./constants";

// Map database plan values to tiers (server-only, reads DB values)
export function getPlanTier(plan?: string | null, status?: string | null): PlanTier {
  if (!plan || !status) return "FREE";
  if (status !== "ACTIVE" && status !== "TRIALING") return "FREE";
  switch (plan) {
    case "STARTER": return "STARTER";
    case "GROWTH": return "GROWTH";
    case "SCALE": return "SCALE";
    default: return "FREE";
  }
}

export const PRODUCT_LIMITS: Record<PlanTier, number> = {
  FREE: 10, STARTER: 100, GROWTH: 1000, SCALE: 999999,
};

export const CERT_LIMITS: Record<PlanTier, number> = {
  FREE: 0, STARTER: 50, GROWTH: 500, SCALE: 999999,
};

export function checkFeature(userPlan: PlanTier, featureId: string) {
  const feature = FEATURES[featureId];
  if (!feature) return { allowed: true, currentPlan: userPlan, requiredPlan: "FREE" as PlanTier, featureLabel: featureId };
  const allowed = hasAccess(userPlan, feature.requiredPlan);
  const upgradePlan = allowed ? undefined : PLANS.find((p) => p.tier === feature.requiredPlan);
  return { allowed, currentPlan: userPlan, requiredPlan: feature.requiredPlan, featureLabel: feature.label, upgradePlan };
}
