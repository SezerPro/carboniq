import type { ReportPeriod } from "@prisma/client";
import prisma from "../../db.server";

/**
 * Generate a comprehensive RSE (Corporate Social Responsibility) report
 * for a shop over a given period.
 */
export async function generateRSEReport(
  shopId: string,
  period: ReportPeriod,
  periodStart: Date,
  periodEnd: Date,
) {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
  });

  // Fetch all products for the shop
  const products = await prisma.product.findMany({
    where: { shopId },
  });

  // Fetch offsets in the period
  const offsets = await prisma.carbonOffset.findMany({
    where: {
      shopId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });

  // Fetch impact actions in the period
  const impactActions = await prisma.impactAction.findMany({
    where: {
      shopId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
  });

  // Fetch monthly snapshots for the period
  const monthlySnapshots = await prisma.monthlySnapshot.findMany({
    where: {
      shopId,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { month: "asc" },
  });

  // Compute summary
  const totalProducts = products.length;
  const totalCarbonKg = products.reduce(
    (sum, p) => sum + (p.carbonScoreKg ?? 0),
    0,
  );
  const avgCarbonKg = totalProducts > 0 ? totalCarbonKg / totalProducts : 0;
  const totalOffsetKg = offsets.reduce((sum, o) => sum + o.carbonKg, 0);
  const netCarbonKg = totalCarbonKg - totalOffsetKg;
  const offsetPercentage =
    totalCarbonKg > 0 ? (totalOffsetKg / totalCarbonKg) * 100 : 0;

  const treesPlanted = impactActions
    .filter((a) => a.type === "TREE")
    .reduce((sum, a) => sum + a.quantity, 0);

  const oceanPlasticKg = impactActions
    .filter((a) => a.type === "OCEAN")
    .reduce((sum, a) => sum + a.quantity, 0);

  // Label distribution
  const distribution = {
    LOW: products.filter((p) => p.carbonLabel === "LOW").length,
    MEDIUM: products.filter((p) => p.carbonLabel === "MEDIUM").length,
    HIGH: products.filter((p) => p.carbonLabel === "HIGH").length,
    VERY_HIGH: products.filter((p) => p.carbonLabel === "VERY_HIGH").length,
  };

  // Top 10 products by carbon footprint
  const topImpactProducts = [...products]
    .sort((a, b) => (b.carbonScoreKg ?? 0) - (a.carbonScoreKg ?? 0))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      carbonScoreKg: p.carbonScoreKg,
      carbonLabel: p.carbonLabel,
    }));

  // Monthly trend from snapshots
  const monthlyTrend = monthlySnapshots.map((s) => ({
    month: s.month,
    totalProducts: s.totalProducts,
    totalCarbonKg: s.totalCarbonKg,
    avgCarbonKg: s.avgCarbonKg,
    totalOffsetKg: s.totalOffsetKg,
  }));

  // Reduction tips summary
  const tips = await prisma.reductionTip.findMany({
    where: { shopId },
  });
  const reductionTips = {
    total: tips.length,
    applied: tips.filter((t) => t.isApplied).length,
    estimatedSavings: tips
      .filter((t) => t.isApplied)
      .reduce((sum, t) => sum + t.potentialSaving, 0),
  };

  const dataJson = {
    shop: { domain: shop.shopDomain, name: shop.name },
    period: {
      type: period,
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    summary: {
      totalProducts,
      totalCarbonKg,
      avgCarbonKg,
      totalOffsetKg,
      netCarbonKg,
      offsetPercentage,
      treesPlanted,
      oceanPlasticKg,
    },
    distribution,
    topImpactProducts,
    monthlyTrend,
    reductionTips,
    methodology: "ADEME Base Carbone + GHG Protocol",
    generatedAt: new Date().toISOString(),
  };

  // Save report to database
  const report = await prisma.rSEReport.create({
    data: {
      shopId,
      period,
      periodStart,
      periodEnd,
      dataJson: JSON.stringify(dataJson),
    },
  });

  return { ...report, data: dataJson };
}

/**
 * Get all reports for a shop, newest first.
 */
export async function getShopReports(shopId: string) {
  return prisma.rSEReport.findMany({
    where: { shopId },
    orderBy: { generatedAt: "desc" },
  });
}

/**
 * Get a single report by ID with parsed dataJson.
 */
export async function getReport(reportId: string) {
  const report = await prisma.rSEReport.findUnique({
    where: { id: reportId },
    include: { shop: { select: { shopDomain: true } } },
  });

  if (!report) return null;

  return {
    ...report,
    data: JSON.parse(report.dataJson),
  };
}
