import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { getShopImpactStats } from "../lib/impact/impact.server";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function silentResponse() {
  return new Response(
    JSON.stringify({ display: "none" }),
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");

  if (!shopDomain) {
    return silentResponse();
  }

  // Verify shop exists and plan is active
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: { subscription: true },
  });

  if (!shop) return silentResponse();

  const activeStatuses = ["TRIALING", "ACTIVE"];
  if (!activeStatuses.includes(shop.planStatus)) {
    return silentResponse();
  }

  const stats = await getShopImpactStats(shop.id);

  return new Response(
    JSON.stringify({
      totalCarbonOffsetKg: stats.carbon.totalKg,
      treesPlanted: stats.trees.totalCount,
      oceanPlasticRemovedKg: stats.ocean.totalKg,
      totalOrders: stats.carbon.count,
      totalInvestedEur: stats.totalEur,
    }),
    { status: 200, headers: CORS_HEADERS },
  );
}
