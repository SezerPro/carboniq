import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[RGPD] ${topic} for ${shop}`);

  // Find all data associated with this customer
  const customerEmail = payload.customer?.email;
  if (!customerEmail) return new Response();

  // Log the request (in production, send this data to the merchant)
  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) return new Response();

  const certificates = await db.certificate.findMany({
    where: { shopId: shopRecord.id, customerEmail },
  });

  const offsets = await db.carbonOffset.findMany({
    where: { shopId: shopRecord.id, customerEmail },
  });

  console.log(`[RGPD] Customer data request for ${customerEmail}: ${certificates.length} certificates, ${offsets.length} offsets`);

  return new Response();
};
