import prisma from "../../db.server";

interface OrderItem {
  productId: string;
  quantity: number;
}

interface OffsetBreakdownItem {
  productId: string;
  quantity: number;
  carbonScoreKg: number;
  totalKg: number;
}

interface OffsetCalculation {
  totalCarbonKg: number;
  offsetCostEur: number;
  breakdown: OffsetBreakdownItem[];
}

/**
 * Calculate the carbon offset cost for a given order.
 * For each item, looks up the product's carbonScoreKg from the database,
 * sums total carbon, and multiplies by the shop's carbonCostEur.
 */
export async function calculateOffsetForOrder(
  shopId: string,
  orderItems: OrderItem[],
): Promise<OffsetCalculation> {
  const productIds = orderItems.map((item) => item.productId);

  const products = await prisma.product.findMany({
    where: {
      shopId,
      shopifyProductId: { in: productIds },
    },
    select: {
      shopifyProductId: true,
      carbonScoreKg: true,
    },
  });

  const productMap = new Map(
    products.map((p) => [p.shopifyProductId, p.carbonScoreKg ?? 0]),
  );

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { carbonCostEur: true },
  });

  const costPerKg = shop?.carbonCostEur ?? 0.01;

  const breakdown: OffsetBreakdownItem[] = orderItems.map((item) => {
    const carbonScoreKg = productMap.get(item.productId) ?? 0;
    return {
      productId: item.productId,
      quantity: item.quantity,
      carbonScoreKg,
      totalKg: carbonScoreKg * item.quantity,
    };
  });

  const totalCarbonKg = breakdown.reduce((sum, item) => sum + item.totalKg, 0);
  const offsetCostEur = Math.round(totalCarbonKg * costPerKg * 100) / 100;

  return {
    totalCarbonKg,
    offsetCostEur,
    breakdown,
  };
}

/**
 * Record a carbon offset after checkout completes.
 * Creates a CarbonOffset record with status PENDING and
 * any associated ImpactAction records if the shop has trees/ocean enabled.
 */
export async function recordOffset(params: {
  shopId: string;
  orderId: string;
  orderName?: string;
  customerEmail?: string;
  carbonKg: number;
  amountEur: number;
}) {
  const { shopId, orderId, orderName, customerEmail, carbonKg, amountEur } =
    params;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      enableTrees: true,
      enableOcean: true,
      treeCostEur: true,
      oceanCostEur: true,
    },
  });

  const offset = await prisma.carbonOffset.create({
    data: {
      shopId,
      orderId,
      orderName: orderName ?? null,
      customerEmail: customerEmail ?? null,
      carbonKg,
      amountEur,
      status: "PENDING",
    },
  });

  const impactActions: Array<{ type: string; label: string }> = [];

  if (shop?.enableTrees) {
    impactActions.push({ type: "TREE", label: "Tree planting" });
  }

  if (shop?.enableOcean) {
    impactActions.push({ type: "OCEAN", label: "Ocean cleanup" });
  }

  if (impactActions.length > 0) {
    await prisma.impactAction.createMany({
      data: impactActions.map((action) => ({
        shopId,
        type: action.type as "CARBON" | "TREE" | "OCEAN",
        quantity: action.type === "TREE" ? 1 : 0.5,
        costEur: action.type === "TREE" ? (shop?.treeCostEur ?? 0.4) : (shop?.oceanCostEur ?? 0.05),
        orderId,
      })),
    });
  }

  return offset;
}

/**
 * Mark an offset as completed, optionally storing the provider reference.
 */
export async function completeOffset(
  offsetId: string,
  providerRef?: string,
) {
  const offset = await prisma.carbonOffset.update({
    where: { id: offsetId },
    data: {
      status: "COMPLETED",
      providerRef: providerRef ?? null,
    },
  });

  return offset;
}
