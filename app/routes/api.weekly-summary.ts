import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { isKlaviyoConfigured, trackOffsetEvent } from "../lib/klaviyo/klaviyo.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Fetch all active shops
  const shops = await db.shop.findMany({
    where: {
      planStatus: { in: ["ACTIVE", "TRIALING"] },
    },
    select: {
      id: true,
      shopDomain: true,
      klaviyoApiKey: true,
      klaviyoListId: true,
    },
  });

  const results: Array<{
    domain: string;
    productsAdded: number;
    offsetsThisWeek: number;
    totalCarbonKg: number;
  }> = [];

  for (const shop of shops) {
    try {
      // Products added this week
      const productsAdded = await db.product.count({
        where: {
          shopId: shop.id,
          createdAt: { gte: sevenDaysAgo },
        },
      });

      // Offsets completed this week
      const offsetsAgg = await db.carbonOffset.aggregate({
        where: {
          shopId: shop.id,
          status: "COMPLETED",
          createdAt: { gte: sevenDaysAgo },
        },
        _count: true,
        _sum: { carbonKg: true },
      });

      const offsetsThisWeek = offsetsAgg._count;
      const totalCarbonKg = offsetsAgg._sum.carbonKg ?? 0;

      results.push({
        domain: shop.shopDomain,
        productsAdded,
        offsetsThisWeek,
        totalCarbonKg,
      });

      // Fire Klaviyo event if configured
      if (isKlaviyoConfigured(shop)) {
        try {
          await trackOffsetEvent(shop, "", {
            carbonKg: totalCarbonKg,
            amountEur: 0,
            orderId: `weekly_summary_${new Date().toISOString().slice(0, 10)}`,
          });
        } catch (e) {
          console.error(`[weekly-summary] Klaviyo error for ${shop.shopDomain}:`, e);
        }
      }
    } catch (e) {
      console.error(`[weekly-summary] Error processing ${shop.shopDomain}:`, e);
    }
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      shops: results,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
