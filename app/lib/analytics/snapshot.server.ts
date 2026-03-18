import db from "../../db.server";

/**
 * Generate or update monthly snapshot for current month.
 * Aggregates all product carbon data, offsets, and impact metrics.
 */
export async function generateMonthlySnapshot(shopId: string) {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // "2026-03"

  // Aggregate all products for this shop
  const products = await db.product.findMany({
    where: { shopId },
    select: {
      carbonScoreKg: true,
      carbonLabel: true,
      productType: true,
    },
  });

  const totalProducts = products.length;
  const totalCarbonKg = products.reduce(
    (sum, p) => sum + (p.carbonScoreKg ?? 0),
    0,
  );
  const avgCarbonKg = totalProducts > 0 ? totalCarbonKg / totalProducts : 0;

  // Count by label
  const labelCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
  for (const p of products) {
    if (p.carbonLabel && p.carbonLabel in labelCounts) {
      labelCounts[p.carbonLabel as keyof typeof labelCounts]++;
    }
  }

  // Compute month boundaries for offset/impact queries
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Sum offsets for this month
  const offsets = await db.carbonOffset.aggregate({
    where: {
      shopId,
      createdAt: { gte: monthStart, lt: nextMonth },
    },
    _sum: {
      carbonKg: true,
      amountEur: true,
    },
  });

  // Sum trees planted for this month
  const treeActions = await db.impactAction.aggregate({
    where: {
      shopId,
      type: "TREE",
      createdAt: { gte: monthStart, lt: nextMonth },
    },
    _sum: { quantity: true },
  });

  // Sum ocean plastic removed for this month
  const oceanActions = await db.impactAction.aggregate({
    where: {
      shopId,
      type: "OCEAN",
      createdAt: { gte: monthStart, lt: nextMonth },
    },
    _sum: { quantity: true },
  });

  // Upsert MonthlySnapshot
  const snapshot = await db.monthlySnapshot.upsert({
    where: {
      shopId_month: { shopId, month },
    },
    create: {
      shopId,
      month,
      totalProducts,
      totalCarbonKg,
      avgCarbonKg,
      countLow: labelCounts.LOW,
      countMedium: labelCounts.MEDIUM,
      countHigh: labelCounts.HIGH,
      countVeryHigh: labelCounts.VERY_HIGH,
      totalOffsetKg: offsets._sum.carbonKg ?? 0,
      totalOffsetEur: offsets._sum.amountEur ?? 0,
      totalTreesPlanted: treeActions._sum.quantity ?? 0,
      totalOceanKg: oceanActions._sum.quantity ?? 0,
    },
    update: {
      totalProducts,
      totalCarbonKg,
      avgCarbonKg,
      countLow: labelCounts.LOW,
      countMedium: labelCounts.MEDIUM,
      countHigh: labelCounts.HIGH,
      countVeryHigh: labelCounts.VERY_HIGH,
      totalOffsetKg: offsets._sum.carbonKg ?? 0,
      totalOffsetEur: offsets._sum.amountEur ?? 0,
      totalTreesPlanted: treeActions._sum.quantity ?? 0,
      totalOceanKg: oceanActions._sum.quantity ?? 0,
    },
  });

  return snapshot;
}

/**
 * Get analytics data for the merchant dashboard.
 * Returns snapshots, trends, top products, distribution, and benchmarks.
 */
export async function getAnalyticsData(shopId: string) {
  // Get last 12 months of snapshots
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffMonth = twelveMonthsAgo.toISOString().slice(0, 7);

  const snapshots = await db.monthlySnapshot.findMany({
    where: {
      shopId,
      month: { gte: cutoffMonth },
    },
    orderBy: { month: "asc" },
  });

  // Compute trends (% change from last month)
  const trends = computeTrends(snapshots);

  // Get top 10 most polluting products
  const topPolluters = await db.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
    orderBy: { carbonScoreKg: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      carbonScoreKg: true,
      carbonLabel: true,
      productType: true,
    },
  });

  // Get top 10 least polluting (greenest) products
  const topGreen = await db.product.findMany({
    where: { shopId, carbonScoreKg: { not: null, gt: 0 } },
    orderBy: { carbonScoreKg: "asc" },
    take: 10,
    select: {
      id: true,
      title: true,
      carbonScoreKg: true,
      carbonLabel: true,
      productType: true,
    },
  });

  // Get distribution by category (productType)
  const products = await db.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
    select: { productType: true, carbonScoreKg: true },
  });

  const categoryMap: Record<string, { count: number; totalKg: number }> = {};
  for (const p of products) {
    const cat = p.productType ?? "Non categorise";
    if (!categoryMap[cat]) {
      categoryMap[cat] = { count: 0, totalKg: 0 };
    }
    categoryMap[cat].count++;
    categoryMap[cat].totalKg += p.carbonScoreKg ?? 0;
  }

  const categoryDistribution = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      count: data.count,
      totalKg: Math.round(data.totalKg * 100) / 100,
      avgKg:
        data.count > 0
          ? Math.round((data.totalKg / data.count) * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.totalKg - a.totalKg);

  // Sector benchmark (static for now, will be dynamic later)
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const shopAvg = latestSnapshot?.avgCarbonKg ?? 0;

  const benchmark = {
    sectorAvgCarbonKg: 12.5,
    sectorLabel: "E-commerce textile",
    shopAvgCarbonKg: shopAvg,
    percentile: computePercentile(shopAvg, 12.5),
  };

  return {
    snapshots: snapshots.map((s) => ({
      month: s.month,
      totalProducts: s.totalProducts,
      totalCarbonKg: s.totalCarbonKg,
      avgCarbonKg: s.avgCarbonKg,
      countLow: s.countLow,
      countMedium: s.countMedium,
      countHigh: s.countHigh,
      countVeryHigh: s.countVeryHigh,
      totalOffsetKg: s.totalOffsetKg,
      totalTreesPlanted: s.totalTreesPlanted,
      totalOceanKg: s.totalOceanKg,
    })),
    trends,
    topPolluters: topPolluters.map((p) => ({
      id: p.id,
      title: p.title,
      carbonScoreKg: p.carbonScoreKg,
      carbonLabel: p.carbonLabel,
      productType: p.productType,
    })),
    topGreen: topGreen.map((p) => ({
      id: p.id,
      title: p.title,
      carbonScoreKg: p.carbonScoreKg,
      carbonLabel: p.carbonLabel,
      productType: p.productType,
    })),
    categoryDistribution,
    benchmark,
  };
}

/**
 * Compute month-over-month trends from snapshots.
 */
function computeTrends(
  snapshots: Array<{
    totalCarbonKg: number;
    avgCarbonKg: number;
    totalProducts: number;
    totalOffsetKg: number;
    month: string;
  }>,
) {
  if (snapshots.length < 2) {
    return {
      totalCarbonChange: 0,
      avgCarbonChange: 0,
      productsChange: 0,
      offsetChange: 0,
    };
  }

  const current = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  };

  return {
    totalCarbonChange: pctChange(current.totalCarbonKg, previous.totalCarbonKg),
    avgCarbonChange: pctChange(current.avgCarbonKg, previous.avgCarbonKg),
    productsChange: pctChange(current.totalProducts, previous.totalProducts),
    offsetChange: pctChange(current.totalOffsetKg, previous.totalOffsetKg),
  };
}

/**
 * Compute a simple percentile based on how the shop compares to sector average.
 * Returns a value 0-100 where lower is better (less carbon).
 */
function computePercentile(shopAvg: number, sectorAvg: number): number {
  if (sectorAvg === 0) return 50;
  const ratio = shopAvg / sectorAvg;
  const percentile = Math.min(100, Math.max(0, Math.round(ratio * 50)));
  return percentile;
}
