import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { calculateAndSave } from "../lib/carbon/engine.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

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
  } catch (error) {
    console.error(`Failed to calculate carbon score for product ${product.id}:`, error);
  }

  return new Response();
};
