import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logger } from "../lib/security/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[RGPD] ${topic} for ${shop}`);

  const customerEmail = payload.customer?.email;
  if (!customerEmail) return new Response();

  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRecord) return new Response();

  // Anonymize customer data in certificates
  await db.certificate.updateMany({
    where: { shopId: shopRecord.id, customerEmail },
    data: { customerEmail: "redacted@anonymized.com", customerName: "Anonymisé" },
  });

  // Anonymize customer data in offsets
  await db.carbonOffset.updateMany({
    where: { shopId: shopRecord.id, customerEmail },
    data: { customerEmail: "redacted@anonymized.com" },
  });

  logger.dataAccess("gdpr_redact_customer", shopRecord.id, "email", "redacted");
  console.log(`[RGPD] Customer data redacted for ${customerEmail} in shop ${shop}`);

  return new Response();
};
