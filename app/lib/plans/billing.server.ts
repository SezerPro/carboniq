import db from "../../db.server";
import type { PlanTier } from "./constants";

const PLAN_PRICES: Record<Exclude<PlanTier, "FREE">, number> = {
  STARTER: 14.90,
  GROWTH: 49.90,
  SCALE: 149.90,
};

const PLAN_NAMES: Record<Exclude<PlanTier, "FREE">, string> = {
  STARTER: "Carboniq Starter",
  GROWTH: "Carboniq Growth",
  SCALE: "Carboniq Scale",
};

const PRODUCT_LIMITS: Record<PlanTier, number> = {
  FREE: 10,
  STARTER: 100,
  GROWTH: 1000,
  SCALE: 999999,
};

/**
 * Create a Shopify AppSubscription via the Billing API.
 * Returns the confirmation URL where the merchant approves the charge.
 */
export async function createSubscription(
  admin: any,
  plan: Exclude<PlanTier, "FREE">,
  shopDomain: string,
  returnUrl: string,
  isTest: boolean = true, // true for dev, false for production
): Promise<{ confirmationUrl: string; subscriptionId: string } | { error: string }> {
  const response = await admin.graphql(
    `#graphql
    mutation appSubscriptionCreate(
      $name: String!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $returnUrl: URL!
      $test: Boolean
      $trialDays: Int
      $replacementBehavior: AppSubscriptionReplacementBehavior
    ) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        test: $test
        trialDays: $trialDays
        replacementBehavior: $replacementBehavior
      ) {
        appSubscription {
          id
          status
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        name: PLAN_NAMES[plan],
        returnUrl,
        test: isTest,
        trialDays: 0,
        replacementBehavior: "APPLY_IMMEDIATELY",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: {
                  amount: PLAN_PRICES[plan],
                  currencyCode: "EUR",
                },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      },
    },
  );

  const json = await response.json();
  const data = json.data?.appSubscriptionCreate;

  if (data?.userErrors?.length > 0) {
    return { error: data.userErrors.map((e: any) => e.message).join(", ") };
  }

  if (!data?.confirmationUrl) {
    return { error: "Impossible de créer l'abonnement" };
  }

  return {
    confirmationUrl: data.confirmationUrl,
    subscriptionId: data.appSubscription?.id ?? "",
  };
}

/**
 * Check the current active subscription status from Shopify.
 */
export async function getActiveSubscription(admin: any): Promise<{
  id: string;
  name: string;
  status: string;
  trialDays: number;
  currentPeriodEnd: string | null;
} | null> {
  const response = await admin.graphql(
    `#graphql
    query {
      appInstallation {
        activeSubscriptions {
          id
          name
          status
          trialDays
          currentPeriodEnd
        }
      }
    }`,
  );

  const json = await response.json();
  const subs = json.data?.appInstallation?.activeSubscriptions ?? [];

  if (subs.length === 0) return null;

  const active = subs[0];
  return {
    id: active.id,
    name: active.name,
    status: active.status,
    trialDays: active.trialDays ?? 0,
    currentPeriodEnd: active.currentPeriodEnd ?? null,
  };
}

/**
 * Cancel the current subscription.
 */
export async function cancelSubscription(admin: any, subscriptionId: string): Promise<boolean> {
  const response = await admin.graphql(
    `#graphql
    mutation appSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        appSubscription {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { variables: { id: subscriptionId } },
  );

  const json = await response.json();
  return (json.data?.appSubscriptionCancel?.userErrors?.length ?? 0) === 0;
}

/**
 * After merchant approves, sync the plan to our database.
 */
export async function syncPlanFromShopify(admin: any, shopDomain: string): Promise<PlanTier> {
  const activeSub = await getActiveSubscription(admin);

  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (!shop) return "FREE";

  if (!activeSub || activeSub.status !== "ACTIVE") {
    // No active sub → free plan
    await db.shop.update({
      where: { id: shop.id },
      data: { plan: "STARTER", planStatus: "CANCELED" },
    });
    return "FREE";
  }

  // Determine plan from subscription name
  let plan: PlanTier = "FREE";
  if (activeSub.name.includes("Scale")) plan = "SCALE";
  else if (activeSub.name.includes("Growth")) plan = "GROWTH";
  else if (activeSub.name.includes("Starter")) plan = "STARTER";

  const status = activeSub.status === "ACTIVE" ? "ACTIVE" : "TRIALING";

  await db.shop.update({
    where: { id: shop.id },
    data: {
      plan: plan === "FREE" ? "STARTER" : plan as any,
      planStatus: status as any,
    },
  });

  // Update subscription record
  await db.subscription.upsert({
    where: { shopId: shop.id },
    create: {
      shopId: shop.id,
      plan: plan === "FREE" ? "STARTER" : plan as any,
      status: status as any,
      shopifyChargeId: activeSub.id,
      productLimit: PRODUCT_LIMITS[plan],
    },
    update: {
      plan: plan === "FREE" ? "STARTER" : plan as any,
      status: status as any,
      shopifyChargeId: activeSub.id,
      productLimit: PRODUCT_LIMITS[plan],
    },
  });

  return plan;
}
