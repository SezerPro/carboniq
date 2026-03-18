import prisma from "../../db.server";
import type { ImpactType } from "@prisma/client";

// ── Record a single impact action ─────────────────────

export async function recordImpact(
  shopId: string,
  type: ImpactType,
  quantity: number,
  costEur: number,
  orderId?: string,
) {
  return prisma.impactAction.create({
    data: {
      shopId,
      type,
      quantity,
      costEur,
      orderId: orderId ?? null,
    },
  });
}

// ── Aggregated stats per shop ─────────────────────────

interface CategoryStats {
  totalKg: number;
  totalEur: number;
  count: number;
}

interface TreeStats {
  totalCount: number;
  totalEur: number;
  count: number;
}

interface ShopImpactStats {
  carbon: CategoryStats;
  trees: TreeStats;
  ocean: CategoryStats;
  totalEur: number;
  totalActions: number;
}

export async function getShopImpactStats(
  shopId: string,
): Promise<ShopImpactStats> {
  const actions = await prisma.impactAction.findMany({
    where: { shopId },
    select: { type: true, quantity: true, costEur: true },
  });

  const stats: ShopImpactStats = {
    carbon: { totalKg: 0, totalEur: 0, count: 0 },
    trees: { totalCount: 0, totalEur: 0, count: 0 },
    ocean: { totalKg: 0, totalEur: 0, count: 0 },
    totalEur: 0,
    totalActions: actions.length,
  };

  for (const action of actions) {
    switch (action.type) {
      case "CARBON":
        stats.carbon.totalKg += action.quantity;
        stats.carbon.totalEur += action.costEur;
        stats.carbon.count += 1;
        break;
      case "TREE":
        stats.trees.totalCount += action.quantity;
        stats.trees.totalEur += action.costEur;
        stats.trees.count += 1;
        break;
      case "OCEAN":
        stats.ocean.totalKg += action.quantity;
        stats.ocean.totalEur += action.costEur;
        stats.ocean.count += 1;
        break;
    }
    stats.totalEur += action.costEur;
  }

  // Round floating-point sums
  stats.carbon.totalKg = Math.round(stats.carbon.totalKg * 100) / 100;
  stats.carbon.totalEur = Math.round(stats.carbon.totalEur * 100) / 100;
  stats.trees.totalEur = Math.round(stats.trees.totalEur * 100) / 100;
  stats.ocean.totalKg = Math.round(stats.ocean.totalKg * 100) / 100;
  stats.ocean.totalEur = Math.round(stats.ocean.totalEur * 100) / 100;
  stats.totalEur = Math.round(stats.totalEur * 100) / 100;

  return stats;
}

// ── Record multi-impact for a single order ────────────

interface ShopSettings {
  enableTrees: boolean;
  enableOcean: boolean;
  treeCostEur: number;
  oceanCostEur: number;
  carbonCostEur: number;
}

export async function recordMultiImpactForOrder(
  shopId: string,
  orderId: string,
  carbonKg: number,
  shop: ShopSettings,
) {
  const impacts = [];

  // Always record carbon impact
  const carbonCost = Math.round(carbonKg * shop.carbonCostEur * 100) / 100;
  const carbonImpact = await recordImpact(
    shopId,
    "CARBON",
    carbonKg,
    carbonCost,
    orderId,
  );
  impacts.push(carbonImpact);

  // If trees enabled: 1 tree per order
  if (shop.enableTrees) {
    const treeImpact = await recordImpact(
      shopId,
      "TREE",
      1,
      shop.treeCostEur,
      orderId,
    );
    impacts.push(treeImpact);
  }

  // If ocean enabled: 0.5kg ocean plastic per order
  if (shop.enableOcean) {
    const oceanImpact = await recordImpact(
      shopId,
      "OCEAN",
      0.5,
      shop.oceanCostEur,
      orderId,
    );
    impacts.push(oceanImpact);
  }

  return impacts;
}

// ── Recent impact timeline ────────────────────────────

export async function getImpactTimeline(shopId: string, limit = 20) {
  return prisma.impactAction.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      quantity: true,
      costEur: true,
      orderId: true,
      createdAt: true,
    },
  });
}
