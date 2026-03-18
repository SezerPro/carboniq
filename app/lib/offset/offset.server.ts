import prisma from "../../db.server";

/**
 * Calculate the offset cost in EUR for a given carbon amount.
 * Uses the shop's carbonCostEur (default 0.01 EUR/kg) plus any markup.
 */
export async function calculateOffsetCost(
  carbonKg: number,
  shop: { carbonCostEur?: number; offsetMarkupPct?: number },
): Promise<number> {
  const baseCost = shop.carbonCostEur ?? 0.01;
  const markupPct = shop.offsetMarkupPct ?? 0;
  const costPerKg = baseCost * (1 + markupPct / 100);
  return Math.round(carbonKg * costPerKg * 100) / 100;
}

/**
 * Create a CarbonOffset record for an order.
 */
export async function createOffset(
  shopId: string,
  orderId: string,
  orderName: string,
  customerEmail: string,
  carbonKg: number,
  amountEur: number,
) {
  const offset = await prisma.carbonOffset.create({
    data: {
      shopId,
      orderId,
      orderName,
      customerEmail,
      carbonKg,
      amountEur,
      status: "PENDING",
    },
  });

  return offset;
}

/**
 * Mark a carbon offset as COMPLETED.
 */
export async function completeOffset(offsetId: string) {
  const offset = await prisma.carbonOffset.update({
    where: { id: offsetId },
    data: { status: "COMPLETED" },
  });

  return offset;
}

/**
 * Get the offset associated with a specific order for a shop.
 */
export async function getOrderOffset(shopId: string, orderId: string) {
  const offset = await prisma.carbonOffset.findFirst({
    where: { shopId, orderId },
    include: { certificate: true },
  });

  return offset;
}

/**
 * Aggregate offset statistics for a shop.
 */
export async function getShopOffsetStats(shopId: string) {
  const allOffsets = await prisma.carbonOffset.findMany({
    where: { shopId },
    select: {
      carbonKg: true,
      amountEur: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalOffsetKg = 0;
  let totalOffsetEur = 0;
  let thisMonthKg = 0;

  for (const o of allOffsets) {
    totalOffsetKg += o.carbonKg;
    totalOffsetEur += o.amountEur;
    if (o.createdAt >= startOfMonth) {
      thisMonthKg += o.carbonKg;
    }
  }

  return {
    totalOffsetKg: Math.round(totalOffsetKg * 100) / 100,
    totalOffsetEur: Math.round(totalOffsetEur * 100) / 100,
    totalOrders: allOffsets.length,
    thisMonthKg: Math.round(thisMonthKg * 100) / 100,
  };
}
