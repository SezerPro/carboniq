import db from "../../db.server";

// Emission factors for different transport modes (kg CO2 per ton-km)
const TRANSPORT_FACTORS = {
  air: 0.602,
  sea: 0.016,
  road: 0.096,
  rail: 0.028,
};

// Packaging emission factors (kg CO2 per kg material)
const PACKAGING_FACTORS = {
  cardboard: 0.9,
  plastic: 3.1,
  paper: 1.3,
  wood: 0.3,
  glass: 0.85,
};

// Calculate shipping emissions for an order
export function calculateShippingEmissions(params: {
  weightKg: number;
  distanceKm: number;
  mode: keyof typeof TRANSPORT_FACTORS;
}): number {
  const tonKm = (params.weightKg / 1000) * params.distanceKm;
  return Math.round(tonKm * TRANSPORT_FACTORS[params.mode] * 1000) / 1000;
}

// Calculate packaging emissions
export function calculatePackagingEmissions(params: {
  materialType: keyof typeof PACKAGING_FACTORS;
  weightKg: number;
}): number {
  return (
    Math.round(
      params.weightKg * PACKAGING_FACTORS[params.materialType] * 1000,
    ) / 1000
  );
}

// Get Scope 3 summary for a shop
export async function getScope3Summary(shopId: string) {
  const entries = await db.scope3Entry.findMany({
    where: { shopId },
  });

  const byCategory = new Map<string, { totalKg: number; count: number }>();
  for (const e of entries) {
    const entry = byCategory.get(e.category) ?? { totalKg: 0, count: 0 };
    entry.totalKg += e.emissionKg;
    entry.count++;
    byCategory.set(e.category, entry);
  }

  const totalScope3 = entries.reduce((s, e) => s + e.emissionKg, 0);

  // Get Scope 1 (product emissions)
  const products = await db.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
  });
  const scope1Total = products.reduce(
    (s, p) => s + (p.carbonScoreKg ?? 0),
    0,
  );

  return {
    scope1: {
      totalKg: Math.round(scope1Total * 100) / 100,
      label: "Produits (Scope 1)",
    },
    scope3: {
      totalKg: Math.round(totalScope3 * 100) / 100,
      categories: Object.fromEntries(
        [...byCategory].map(([cat, data]) => [
          cat,
          {
            totalKg: Math.round(data.totalKg * 100) / 100,
            count: data.count,
          },
        ]),
      ),
    },
    grandTotal: Math.round((scope1Total + totalScope3) * 100) / 100,
    entries: entries.map((e) => ({
      id: e.id,
      category: e.category,
      emissionKg: e.emissionKg,
      source: e.source,
      period: e.period,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// Record a Scope 3 entry
export async function recordScope3(
  shopId: string,
  category: string,
  emissionKg: number,
  source: string,
  dataJson?: string,
) {
  const period = new Date().toISOString().slice(0, 7);
  return db.scope3Entry.create({
    data: { shopId, category, emissionKg, source, period, dataJson },
  });
}

// Estimate Scope 3 for a shop based on product data
export async function estimateScope3(shopId: string): Promise<number> {
  const products = await db.product.findMany({
    where: { shopId, carbonScoreKg: { not: null } },
  });

  let totalScope3 = 0;
  const period = new Date().toISOString().slice(0, 7);

  // Delete old estimates for this period
  await db.scope3Entry.deleteMany({
    where: { shopId, period, source: "estimate" },
  });

  // Estimate upstream transport (Category 4): ~15% of product carbon
  const upstreamTransport = products.reduce(
    (s, p) => s + (p.carbonScoreKg ?? 0) * 0.15,
    0,
  );
  if (upstreamTransport > 0) {
    await db.scope3Entry.create({
      data: {
        shopId,
        category: "upstream_transport",
        emissionKg: Math.round(upstreamTransport * 100) / 100,
        source: "estimate",
        period,
      },
    });
    totalScope3 += upstreamTransport;
  }

  // Estimate downstream delivery (Category 9): ~8% of product carbon
  const downstream = products.reduce(
    (s, p) => s + (p.carbonScoreKg ?? 0) * 0.08,
    0,
  );
  if (downstream > 0) {
    await db.scope3Entry.create({
      data: {
        shopId,
        category: "downstream_delivery",
        emissionKg: Math.round(downstream * 100) / 100,
        source: "estimate",
        period,
      },
    });
    totalScope3 += downstream;
  }

  // Estimate packaging (Category 4): avg 0.2 kg CO2 per product
  const packaging = products.length * 0.2;
  if (packaging > 0) {
    await db.scope3Entry.create({
      data: {
        shopId,
        category: "packaging",
        emissionKg: Math.round(packaging * 100) / 100,
        source: "estimate",
        period,
      },
    });
    totalScope3 += packaging;
  }

  // Estimate end of life (Category 12): ~5% of product carbon
  const endOfLife = products.reduce(
    (s, p) => s + (p.carbonScoreKg ?? 0) * 0.05,
    0,
  );
  if (endOfLife > 0) {
    await db.scope3Entry.create({
      data: {
        shopId,
        category: "end_of_life",
        emissionKg: Math.round(endOfLife * 100) / 100,
        source: "estimate",
        period,
      },
    });
    totalScope3 += endOfLife;
  }

  return Math.round(totalScope3 * 100) / 100;
}
