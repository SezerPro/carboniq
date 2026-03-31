import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { calculateAndSave } from "../lib/carbon/engine.server";
import { syncProductMetafield } from "../lib/carbon/metafields.server";
import { triggerProductScored, triggerThresholdExceeded } from "../lib/flow/triggers.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    console.log(`Shop ${shop} not found, skipping product create webhook`);
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
      `Product ${product.id} scored: ${result.carbonScoreKg}kg CO₂ (${result.carbonLabel})`,
    );

    // Sync metafields and Flow triggers (requires admin API)
    const gid = `gid://shopify/Product/${product.id}`;
    if (admin) {
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

      // Tag high-impact products (threshold: 10 kgCO₂e)
      if (result.carbonScoreKg >= 10) {
        void triggerThresholdExceeded(admin, gid, result.carbonScoreKg, 10);
      }
    }
  } catch (error) {
    console.error(`Failed to calculate carbon score for product ${product.id}:`, error);
  }

  return new Response();
};
