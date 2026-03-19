import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[RGPD] ${topic} for ${shop}`);

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) return new Response();

  // Delete all shop data (cascade will handle related records)
  await db.shop.delete({ where: { id: shopRecord.id } });

  console.log(`[RGPD] All data deleted for shop ${shop}`);

  return new Response();
};
