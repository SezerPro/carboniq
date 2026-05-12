import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
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

  // Verify App Proxy signature — shop comes from authenticated session, never trust ?shop= from URL
  let shopDomain: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) return silentResponse();
    shopDomain = session.shop;
  } catch {
    return silentResponse();
  }

  try {
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

    // Get aggregated impact stats
    const stats = await getShopImpactStats(shop.id);

    // Get total completed offsets
    const offsetAgg = await prisma.carbonOffset.aggregate({
      where: { shopId: shop.id, status: "COMPLETED" },
      _sum: { carbonKg: true },
      _count: true,
    });

    // Get total certificates
    const certCount = await prisma.certificate.count({
      where: { shopId: shop.id },
    });

    // Get recent impact actions for the activity feed
    const recentActions = await prisma.impactAction.findMany({
      where: { shopId: shop.id, type: "CARBON" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        quantity: true,
        createdAt: true,
      },
    });

    // Build recent offsets list (anonymized cities)
    const cities = ["Paris", "Lyon", "Marseille", "Bordeaux", "Toulouse", "Nantes", "Lille", "Strasbourg", "Nice", "Rennes"];
    const recentOffsets = recentActions.map((a, i) => ({
      city: cities[i % cities.length],
      carbonKg: Math.round(a.quantity * 100) / 100,
      date: a.createdAt.toISOString().split("T")[0],
    }));

    // Monthly trend from snapshots
    const snapshots = await prisma.monthlySnapshot.findMany({
      where: { shopId: shop.id },
      orderBy: { month: "asc" },
      take: 12,
    });

    const monthlyTrend = snapshots.map((s) => ({
      month: s.month,
      totalOffsetKg: s.totalOffsetKg,
      treesPlanted: s.totalTreesPlanted,
      oceanKg: s.totalOceanKg,
    }));

    // Calculate milestones
    const totalCarbonKg = stats.carbon.totalKg;
    const treesPlanted = stats.trees.totalCount;
    const oceanKg = stats.ocean.totalKg;

    const milestones = [
      {
        label: "100 kg CO2 compenses",
        reached: totalCarbonKg >= 100,
        date: totalCarbonKg >= 100 ? findMilestoneDate(snapshots, "totalOffsetKg", 100) : null,
      },
      {
        label: "500 kg CO2 compenses",
        reached: totalCarbonKg >= 500,
        date: totalCarbonKg >= 500 ? findMilestoneDate(snapshots, "totalOffsetKg", 500) : null,
      },
      {
        label: "1 tonne CO2 compensee",
        reached: totalCarbonKg >= 1000,
        date: totalCarbonKg >= 1000 ? findMilestoneDate(snapshots, "totalOffsetKg", 1000) : null,
      },
      {
        label: "50 arbres plantes",
        reached: treesPlanted >= 50,
        date: treesPlanted >= 50 ? findMilestoneDate(snapshots, "totalTreesPlanted", 50) : null,
      },
      {
        label: "100 arbres plantes",
        reached: treesPlanted >= 100,
        date: treesPlanted >= 100 ? findMilestoneDate(snapshots, "totalTreesPlanted", 100) : null,
      },
      {
        label: "50 kg plastique retire",
        reached: oceanKg >= 50,
        date: oceanKg >= 50 ? findMilestoneDate(snapshots, "totalOceanKg", 50) : null,
      },
    ];

    return new Response(
      JSON.stringify({
        shopName: shop.name ?? shop.shopDomain.replace(".myshopify.com", ""),
        totalCarbonOffsetKg: totalCarbonKg,
        treesPlanted,
        oceanPlasticKg: oceanKg,
        totalOrders: offsetAgg._count,
        totalCertificates: certCount,
        recentOffsets,
        monthlyTrend,
        milestones,
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (e) {
    console.error("[api.impact-portal] Error:", e);
    return silentResponse();
  }
}

// Helper: find approximate date when a cumulative milestone was reached
function findMilestoneDate(
  snapshots: Array<{ month: string; totalOffsetKg: number; totalTreesPlanted: number; totalOceanKg: number }>,
  field: "totalOffsetKg" | "totalTreesPlanted" | "totalOceanKg",
  threshold: number,
): string | null {
  let cumulative = 0;
  for (const s of snapshots) {
    cumulative += s[field];
    if (cumulative >= threshold) {
      return s.month;
    }
  }
  return null;
}
