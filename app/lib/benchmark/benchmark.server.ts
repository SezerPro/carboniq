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
  // Get this shop's data
  const shopProducts = await db.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
  });

  const shopAvg =
    shopProducts.length > 0
      ? shopProducts.reduce((s, p) => s + (p.carbonScoreKg ?? 0), 0) /
        shopProducts.length
      : 0;

  // Get all shops' averages for benchmarking
  const allShops = await db.shop.findMany({
    include: { products: { where: { carbonScoreKg: { not: null } } } },
  });

  const shopAverages: number[] = [];
  for (const shop of allShops) {
    if (shop.products.length > 0) {
      const avg =
        shop.products.reduce((s, p) => s + (p.carbonScoreKg ?? 0), 0) /
        shop.products.length;
      shopAverages.push(avg);
    }
  }

  // Calculate percentile (lower carbon = better = lower percentile number)
  const sorted = [...shopAverages].sort((a, b) => a - b);
  const rank = sorted.findIndex((v) => v >= shopAvg);
  const percentile =
    sorted.length > 0 ? Math.round((rank / sorted.length) * 100) : 50;
  const betterThanPct = 100 - percentile;

  // Global average
  const globalAvg =
    shopAverages.length > 0
      ? shopAverages.reduce((s, v) => s + v, 0) / shopAverages.length
      : shopAvg;

  // Industry averages by category (from all shops)
  const allProducts = await db.product.findMany({
    where: { carbonScoreKg: { not: null } },
  });

  const catSums = new Map<string, { total: number; count: number }>();
  for (const p of allProducts) {
    const cat = p.categoryCode ?? "generic.default";
    const entry = catSums.get(cat) ?? { total: 0, count: 0 };
    entry.total += p.carbonScoreKg ?? 0;
    entry.count++;
    catSums.set(cat, entry);
  }

  const industryAvg: Record<string, number> = {};
  for (const [cat, data] of catSums) {
    industryAvg[cat] = Math.round((data.total / data.count) * 100) / 100;
  }

  // Shop by category
  const shopCatSums = new Map<string, { total: number; count: number }>();
  for (const p of shopProducts) {
    const cat = p.categoryCode ?? "generic.default";
    const entry = shopCatSums.get(cat) ?? { total: 0, count: 0 };
    entry.total += p.carbonScoreKg ?? 0;
    entry.count++;
    shopCatSums.set(cat, entry);
  }

  const shopByCategory: Record<string, { avg: number; count: number }> = {};
  for (const [cat, data] of shopCatSums) {
    shopByCategory[cat] = {
      avg: Math.round((data.total / data.count) * 100) / 100,
      count: data.count,
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
