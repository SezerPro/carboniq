/**
 * Server-only plan helpers (can import Prisma etc.)
 * Re-exports client-safe constants from constants.ts
 */

export { type PlanTier, hasAccess, FEATURES, PLANS, FEATURES as default } from "./constants";
export type { FeatureGate, PlanInfo } from "./constants";

import type { PlanTier } from "./constants";
import { hasAccess, FEATURES, PLANS } from "./constants";
import db from "../../db.server";

// Map database plan values to tiers (server-only, reads DB values)
export function getPlanTier(plan?: string | null, status?: string | null): PlanTier {
  if (!plan || !status) return "FREE";
  if (status !== "ACTIVE" && status !== "TRIALING") return "FREE";
  switch (plan) {
    case "STARTER": return "STARTER";
    case "GROWTH": return "GROWTH";
    case "PRO": return "PRO";
    case "SCALE": return "SCALE";
    default: return "FREE";
  }
}

export const PRODUCT_LIMITS: Record<PlanTier, number> = {
  FREE: 10, STARTER: 100, GROWTH: 1000, PRO: 5000, SCALE: 999999,
};

export const CERT_LIMITS: Record<PlanTier, number> = {
  FREE: 0, STARTER: 50, GROWTH: 500, PRO: 2000, SCALE: 999999,
};

export function checkFeature(userPlan: PlanTier, featureId: string) {
  const feature = FEATURES[featureId];
  if (!feature) return { allowed: true, currentPlan: userPlan, requiredPlan: "FREE" as PlanTier, featureLabel: featureId };
  const allowed = hasAccess(userPlan, feature.requiredPlan);
  const upgradePlan = allowed ? undefined : PLANS.find((p) => p.tier === feature.requiredPlan);
  return { allowed, currentPlan: userPlan, requiredPlan: feature.requiredPlan, featureLabel: feature.label, upgradePlan };
}

/**
 * Load the current plan tier for a shop by its `shopDomain` (e.g. `xxx.myshopify.com`).
 * Returns "FREE" if the shop record is missing or the subscription is cancelled/expired.
 */
export async function getPlanForShopDomain(shopDomain: string): Promise<PlanTier> {
  const shop = await db.shop.findUnique({
    where: { shopDomain },
    select: { plan: true, planStatus: true },
  });
  return getPlanTier(shop?.plan, shop?.planStatus);
}

/**
 * Server-side gate for paid feature routes. Throws a Response (HTTP 402)
 * if the authenticated shop does not have access to the requested feature.
 *
 * Usage in a loader/action:
 *   const { session } = await authenticate.admin(request);
 *   await requireFeature(session.shop, "scope3");
 *
 * The thrown Response is caught by the React Router runtime and surfaced
 * either as a JSON error (for fetcher.submit) or as an error boundary page.
 */
export async function requireFeature(shopDomain: string, featureId: string): Promise<PlanTier> {
  const tier = await getPlanForShopDomain(shopDomain);
  const feature = FEATURES[featureId];
  if (!feature) return tier;
  if (!hasAccess(tier, feature.requiredPlan)) {
    throw new Response(
      JSON.stringify({
        error: "upgrade_required",
        feature: featureId,
        featureLabel: feature.label,
        requiredPlan: feature.requiredPlan,
        currentPlan: tier,
      }),
      {
        status: 402,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return tier;
}
