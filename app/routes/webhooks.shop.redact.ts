import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`[RGPD] ${topic} for ${shop}`);

  // 1. Delete OAuth sessions explicitly (there is no FK Session→Shop so the
  //    db.shop.delete cascade below would leave them behind).
  await db.session.deleteMany({ where: { shop } });

  // 2. Delete the shop row; Prisma cascades to all tenant data
  //    (Subscription, Product, CarbonOffset, Certificate, ImpactAction,
  //    MonthlySnapshot, ABTest, RSEReport, ComplianceScan, Scope3Entry, etc.).
  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (shopRecord) {
    await db.shop.delete({ where: { id: shopRecord.id } });
  }

  console.log(`[RGPD] All data and sessions deleted for shop ${shop}`);

  return new Response();
};
