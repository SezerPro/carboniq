import db from "../../db.server";

interface BenchmarkData {
  shopAvgCarbonKg: number;
  globalAvgCarbonKg: number;
  percentile: number; // 0-100, lower is better
  betterThanPct: number;
  industryAvg: Record<string, number>; // category -> avg kg
  shopByCategory: Record<string, { avg: number; count: number }>;
}

export async function getShopBenchmark(shopId: string): Promise<BenchmarkData> {
  // Shop's own aggregate (no full scan)
  const shopAgg = await db.product.aggregate({
    where: { shopId, carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
    _count: true,
  });
  const shopAvg = shopAgg._avg.carbonScoreKg ?? 0;

  // Global aggregate — anonymized, no individual shop data exposed
  const globalAgg = await db.product.aggregate({
    where: { carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
    _count: true,
  });
  const globalAvg = globalAgg._avg.carbonScoreKg ?? shopAvg;

  // Count shops with lower average than this shop (for percentile)
  // Use groupBy to get per-shop averages without loading all data
  const shopAverages = await db.product.groupBy({
    by: ["shopId"],
    where: { carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
  });

  const totalShops = shopAverages.length;
  const shopsWithLowerAvg = shopAverages.filter(
    (s) => (s._avg.carbonScoreKg ?? 0) < shopAvg,
  ).length;
  const percentile =
    totalShops > 0 ? Math.round((shopsWithLowerAvg / totalShops) * 100) : 50;
  const betterThanPct = 100 - percentile;

  // Industry averages by category — anonymized aggregation only
  const categoryAggs = await db.product.groupBy({
    by: ["categoryCode"],
    where: { carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
  });

  const industryAvg: Record<string, number> = {};
  for (const cat of categoryAggs) {
    const key = cat.categoryCode ?? "generic.default";
    industryAvg[key] =
      Math.round((cat._avg.carbonScoreKg ?? 0) * 100) / 100;
  }

  // Shop's own categories — only this shop's data
  const shopCategoryAggs = await db.product.groupBy({
    by: ["categoryCode"],
    where: { shopId, carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
    _count: true,
  });

  const shopByCategory: Record<string, { avg: number; count: number }> = {};
  for (const cat of shopCategoryAggs) {
    const key = cat.categoryCode ?? "generic.default";
    shopByCategory[key] = {
      avg: Math.round((cat._avg.carbonScoreKg ?? 0) * 100) / 100,
      count: cat._count,
    };
  }

  return {
    shopAvgCarbonKg: Math.round(shopAvg * 100) / 100,
    globalAvgCarbonKg: Math.round(globalAvg * 100) / 100,
    percentile,
    betterThanPct,
    industryAvg,
    shopByCategory,
  };
}
