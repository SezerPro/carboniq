import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { calculateAndSave } from "../lib/carbon/engine.server";
import { syncProductMetafield } from "../lib/carbon/metafields.server";
import { triggerProductScored, triggerLabelChanged, triggerThresholdExceeded } from "../lib/flow/triggers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    console.log(`Shop ${shop} not found, skipping product update webhook`);
    return new Response();
  }

  // Skip if the merchant has manually overridden the score
  const existing = await db.product.findUnique({
    where: {
      shopId_shopifyProductId: {
        shopId: shopRecord.id,
        shopifyProductId: String(payload.id),
      },
    },
  });

  if (existing?.isManualOverride) {
    console.log(`Product ${payload.id} has manual override, skipping recalculation`);
    return new Response();
  }

  const product = {
    id: String(payload.id),
    title: payload.title ?? "",
    product_type: payload.product_type ?? null,
    tags: payload.tags ?? null,
    vendor: payload.vendor ?? null,
    weight: payload.variants?.[0]?.weight
      ? Number(payload.variants[0].weight) * 1000
      : null,
  };

  try {
    const result = await calculateAndSave(shopRecord.id, product);
    console.log(
      `Product ${product.id} updated: ${result.carbonScoreKg}kg CO₂ (${result.carbonLabel})`,
    );

    // Sync metafields to Shopify (fire-and-forget)
    const gid = `gid://shopify/Product/${product.id}`;
    try {
      await syncProductMetafield(
        admin,
        gid,
        result.carbonScoreKg,
        result.carbonLabel,
        result.categoryCode,
      );
    } catch (metaErr) {
      console.error(`Metafield sync failed for product ${product.id}:`, metaErr);
    }

    // Flow triggers (fire-and-forget)
    void triggerProductScored(admin, gid, result.carbonScoreKg, result.carbonLabel);

    // If label changed, trigger label.changed
    const oldLabel = existing?.carbonLabel;
    if (oldLabel && oldLabel !== result.carbonLabel) {
      void triggerLabelChanged(admin, gid, oldLabel, result.carbonLabel);
    }

    // Tag high-impact products (threshold: 10 kgCO₂e)
    if (result.carbonScoreKg >= 10) {
      void triggerThresholdExceeded(admin, gid, result.carbonScoreKg, 10);
    }
  } catch (error) {
    console.error(`Failed to recalculate carbon score for product ${product.id}:`, error);
  }

  return new Response();
};
