import prisma from "../../db.server";
import type { CarbonLabel } from "@prisma/client";

// ── Types ──────────────────────────────────────────────

interface DistributionEntry {
  label: CarbonLabel;
  count: number;
  percentage: number;
}

interface ProductSummary {
  id: string;
  title: string;
  carbonScoreKg: number;
  carbonLabel: CarbonLabel | null;
}

interface CategoryBreakdownEntry {
  categoryCode: string;
  totalCarbonKg: number;
  productCount: number;
  avgCarbonKg: number;
}

interface OffsetStats {
  totalOffsetKg: number;
  totalEurSpent: number;
  totalCertificates: number;
}

export interface ShopAnalytics {
  totalProducts: number;
  totalCarbonKg: number;
  avgCarbonKg: number;
  distribution: Record<CarbonLabel, DistributionEntry>;
  topPolluterProducts: ProductSummary[];
  topCleanProducts: ProductSummary[];
  categoryBreakdown: CategoryBreakdownEntry[];
  offsetStats: OffsetStats;
}

export interface MonthlyTrendEntry {
  month: string;
  totalCarbonKg: number;
  avgCarbonKg: number;
  productCount: number;
  offsetKg: number;
}

export interface BenchmarkResult {
  shopAvg: number;
  globalAvg: number;
  percentile: number;
  betterThanPct: number;
}

export interface ComparisonResult {
  carKm: string;
  flights: string;
  netflixHours: string;
  smartphones: string;
  tshirts: string;
  beefKg: string;
}

// ── getShopAnalytics ───────────────────────────────────

export async function getShopAnalytics(
  shopId: string,
): Promise<ShopAnalytics> {
  // Fetch all products with a carbon score
  const products = await prisma.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
    select: {
      id: true,
      title: true,
      carbonScoreKg: true,
      carbonLabel: true,
      categoryCode: true,
    },
  });

  const totalProducts = products.length;
  const totalCarbonKg = products.reduce(
    (sum, p) => sum + (p.carbonScoreKg ?? 0),
    0,
  );
  const avgCarbonKg = totalProducts > 0 ? totalCarbonKg / totalProducts : 0;

  // Distribution by label
  const labelCounts: Record<CarbonLabel, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    VERY_HIGH: 0,
  };
  for (const p of products) {
    if (p.carbonLabel && p.carbonLabel in labelCounts) {
      labelCounts[p.carbonLabel]++;
    }
  }

  const distribution = {} as Record<CarbonLabel, DistributionEntry>;
  for (const label of ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as CarbonLabel[]) {
    distribution[label] = {
      label,
      count: labelCounts[label],
      percentage:
        totalProducts > 0
          ? Math.round((labelCounts[label] / totalProducts) * 10000) / 100
          : 0,
    };
  }

  // Top 10 polluters (highest carbonScoreKg)
  const sortedDesc = [...products]
    .filter((p) => p.carbonScoreKg != null)
    .sort((a, b) => (b.carbonScoreKg ?? 0) - (a.carbonScoreKg ?? 0));

  const topPolluterProducts: ProductSummary[] = sortedDesc
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      carbonScoreKg: p.carbonScoreKg!,
      carbonLabel: p.carbonLabel,
    }));

  // Top 10 cleanest (lowest carbonScoreKg > 0)
  const sortedAsc = [...products]
    .filter((p) => p.carbonScoreKg != null && p.carbonScoreKg > 0)
    .sort((a, b) => (a.carbonScoreKg ?? 0) - (b.carbonScoreKg ?? 0));

  const topCleanProducts: ProductSummary[] = sortedAsc
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      carbonScoreKg: p.carbonScoreKg!,
      carbonLabel: p.carbonLabel,
    }));

  // Category breakdown
  const categoryMap: Record<string, { totalKg: number; count: number }> = {};
  for (const p of products) {
    const cat = p.categoryCode ?? "unknown";
    if (!categoryMap[cat]) {
      categoryMap[cat] = { totalKg: 0, count: 0 };
    }
    categoryMap[cat].totalKg += p.carbonScoreKg ?? 0;
    categoryMap[cat].count++;
  }

  const categoryBreakdown: CategoryBreakdownEntry[] = Object.entries(
    categoryMap,
  )
    .map(([categoryCode, data]) => ({
      categoryCode,
      totalCarbonKg: Math.round(data.totalKg * 100) / 100,
      productCount: data.count,
      avgCarbonKg:
        data.count > 0
          ? Math.round((data.totalKg / data.count) * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.totalCarbonKg - a.totalCarbonKg);

  // Offset stats
  const offsetAgg = await prisma.carbonOffset.aggregate({
    where: { shopId },
    _sum: { carbonKg: true, amountEur: true },
  });

  const certificateCount = await prisma.certificate.count({
    where: { shopId },
  });

  const offsetStats: OffsetStats = {
    totalOffsetKg: offsetAgg._sum.carbonKg ?? 0,
    totalEurSpent: offsetAgg._sum.amountEur ?? 0,
    totalCertificates: certificateCount,
  };

  return {
    totalProducts,
    totalCarbonKg: Math.round(totalCarbonKg * 100) / 100,
    avgCarbonKg: Math.round(avgCarbonKg * 100) / 100,
    distribution,
    topPolluterProducts,
    topCleanProducts,
    categoryBreakdown,
    offsetStats,
  };
}

// ── getMonthlyTrend ────────────────────────────────────

export async function getMonthlyTrend(
  shopId: string,
  months: number = 6,
): Promise<MonthlyTrendEntry[]> {
  // Calculate the cutoff month
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffMonth = cutoff.toISOString().slice(0, 7);

  const snapshots = await prisma.monthlySnapshot.findMany({
    where: {
      shopId,
      month: { gte: cutoffMonth },
    },
    orderBy: { month: "asc" },
  });

  return snapshots.map((s) => ({
    month: s.month,
    totalCarbonKg: s.totalCarbonKg,
    avgCarbonKg: s.avgCarbonKg,
    productCount: s.totalProducts,
    offsetKg: s.totalOffsetKg,
  }));
}

// ── takeMonthlySnapshot ────────────────────────────────

export async function takeMonthlySnapshot(shopId: string) {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // "YYYY-MM"

  // Aggregate products
  const products = await prisma.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
    select: { carbonScoreKg: true, carbonLabel: true },
  });

  const totalProducts = products.length;
  const totalCarbonKg = products.reduce(
    (sum, p) => sum + (p.carbonScoreKg ?? 0),
    0,
  );
  const avgCarbonKg = totalProducts > 0 ? totalCarbonKg / totalProducts : 0;

  const labelCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
  for (const p of products) {
    if (p.carbonLabel && p.carbonLabel in labelCounts) {
      labelCounts[p.carbonLabel as keyof typeof labelCounts]++;
    }
  }

  // Compute month boundaries for offset / impact queries
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Aggregate offsets for this month
  const offsetAgg = await prisma.carbonOffset.aggregate({
    where: {
      shopId,
      createdAt: { gte: monthStart, lt: nextMonth },
    },
    _sum: { carbonKg: true, amountEur: true },
  });

  // Aggregate impact actions for this month
  const treeActions = await prisma.impactAction.aggregate({
    where: {
      shopId,
      type: "TREE",
      createdAt: { gte: monthStart, lt: nextMonth },
    },
    _sum: { quantity: true },
  });

  const oceanActions = await prisma.impactAction.aggregate({
    where: {
      shopId,
      type: "OCEAN",
      createdAt: { gte: monthStart, lt: nextMonth },
    },
    _sum: { quantity: true },
  });

  // Upsert snapshot
  const snapshot = await prisma.monthlySnapshot.upsert({
    where: {
      shopId_month: { shopId, month },
    },
    create: {
      shopId,
      month,
      totalProducts,
      totalCarbonKg: Math.round(totalCarbonKg * 100) / 100,
      avgCarbonKg: Math.round(avgCarbonKg * 100) / 100,
      countLow: labelCounts.LOW,
      countMedium: labelCounts.MEDIUM,
      countHigh: labelCounts.HIGH,
      countVeryHigh: labelCounts.VERY_HIGH,
      totalOffsetKg: offsetAgg._sum.carbonKg ?? 0,
      totalOffsetEur: offsetAgg._sum.amountEur ?? 0,
      totalTreesPlanted: treeActions._sum.quantity ?? 0,
      totalOceanKg: oceanActions._sum.quantity ?? 0,
    },
    update: {
      totalProducts,
      totalCarbonKg: Math.round(totalCarbonKg * 100) / 100,
      avgCarbonKg: Math.round(avgCarbonKg * 100) / 100,
      countLow: labelCounts.LOW,
      countMedium: labelCounts.MEDIUM,
      countHigh: labelCounts.HIGH,
      countVeryHigh: labelCounts.VERY_HIGH,
      totalOffsetKg: offsetAgg._sum.carbonKg ?? 0,
      totalOffsetEur: offsetAgg._sum.amountEur ?? 0,
      totalTreesPlanted: treeActions._sum.quantity ?? 0,
      totalOceanKg: oceanActions._sum.quantity ?? 0,
    },
  });

  return snapshot;
}

// ── getBenchmark ───────────────────────────────────────

export async function getBenchmark(
  shopId: string,
): Promise<BenchmarkResult> {
  // Get this shop's average
  const shopAgg = await prisma.product.aggregate({
    where: { shopId, carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
  });
  const shopAvg = shopAgg._avg.carbonScoreKg ?? 0;

  // Get global average across all shops
  const globalAgg = await prisma.product.aggregate({
    where: { carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
  });
  const globalAvg = globalAgg._avg.carbonScoreKg ?? 0;

  // Compute per-shop averages to determine percentile
  const allShops = await prisma.product.groupBy({
    by: ["shopId"],
    where: { carbonScoreKg: { not: null } },
    _avg: { carbonScoreKg: true },
  });

  // Count how many shops have a higher (worse) average than this shop
  const totalShops = allShops.length;
  const shopsWithHigherAvg = allShops.filter(
    (s) => (s._avg.carbonScoreKg ?? 0) > shopAvg,
  ).length;

  // Percentile: what % of shops have a higher avg (i.e., this shop is better than X%)
  const betterThanPct =
    totalShops > 1
      ? Math.round((shopsWithHigherAvg / (totalShops - 1)) * 100)
      : 50;

  // Percentile position (0 = best, 100 = worst)
  const shopsWithLowerAvg = allShops.filter(
    (s) => (s._avg.carbonScoreKg ?? 0) < shopAvg,
  ).length;
  const percentile =
    totalShops > 1
      ? Math.round((shopsWithLowerAvg / (totalShops - 1)) * 100)
      : 50;

  return {
    shopAvg: Math.round(shopAvg * 100) / 100,
    globalAvg: Math.round(globalAvg * 100) / 100,
    percentile,
    betterThanPct,
  };
}

// ── getComparison ──────────────────────────────────────

export function getComparison(carbonKg: number): ComparisonResult {
  const round = (v: number, decimals = 1) =>
    Math.round(v * 10 ** decimals) / 10 ** decimals;

  const fmt = (value: number, unit: string): string => {
    if (value >= 10000) {
      return `${Math.round(value).toLocaleString("fr-FR")} ${unit}`;
    }
    if (value >= 100) {
      return `${Math.round(value).toLocaleString("fr-FR")} ${unit}`;
    }
    return `${round(value).toLocaleString("fr-FR")} ${unit}`;
  };

  const carKm = carbonKg / 0.21;
  const flights = carbonKg / 255;
  const netflixHours = carbonKg / 0.036;
  const smartphones = carbonKg / 70;
  const tshirts = carbonKg / 4;
  const beefKg = carbonKg / 26.6;

  return {
    carKm: fmt(carKm, "km en voiture"),
    flights: fmt(flights, "vols Paris-Londres"),
    netflixHours: fmt(netflixHours, "heures de Netflix"),
    smartphones: fmt(smartphones, "smartphones fabriques"),
    tshirts: fmt(tshirts, "t-shirts produits"),
    beefKg: fmt(beefKg, "kg de boeuf"),
  };
}
