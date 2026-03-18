import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    console.log(`Shop ${shop} not found, skipping product delete webhook`);
    return new Response();
  }

  try {
    await db.product.deleteMany({
      where: {
        shopId: shopRecord.id,
        shopifyProductId: String(payload.id),
      },
    });
    console.log(`Product ${payload.id} deleted from carbon database`);
  } catch (error) {
    console.error(`Failed to delete product ${payload.id}:`, error);
  }

  return new Response();
};
