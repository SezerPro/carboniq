/**
 * Seed test data — simulates real usage
 * Run with: npx tsx prisma/seed-test.ts
 */

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.findFirst();
  if (!shop) {
    console.log("No shop found. Open the app first to create a shop.");
    return;
  }

  console.log(`Seeding test data for ${shop.shopDomain}...`);

  // 1. Create test offsets
  console.log("\n1. Creating offsets...");
  const offsets = [];
  for (let i = 0; i < 5; i++) {
    const offset = await prisma.carbonOffset.create({
      data: {
        shopId: shop.id,
        orderId: `TEST-ORDER-${1000 + i}`,
        orderName: `#${1000 + i}`,
        customerEmail: `client${i + 1}@example.com`,
        carbonKg: Math.round((2 + Math.random() * 8) * 100) / 100,
        amountEur: Math.round((0.5 + Math.random() * 2) * 100) / 100,
        status: "COMPLETED",
      },
    });
    offsets.push(offset);
    console.log(`   Offset ${offset.id}: ${offset.carbonKg}kg, ${offset.amountEur} EUR`);
  }

  // 2. Create test certificates
  console.log("\n2. Creating certificates...");
  for (let i = 0; i < offsets.length; i++) {
    const code = `CIQ-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const cert = await prisma.certificate.create({
      data: {
        shopId: shop.id,
        offsetId: offsets[i].id,
        customerEmail: offsets[i].customerEmail ?? "",
        customerName: `Client ${i + 1}`,
        orderName: offsets[i].orderName ?? "",
        carbonKg: offsets[i].carbonKg,
        treesPlanted: Math.round(Math.random() * 3 * 10) / 10,
        oceanKg: Math.round(Math.random() * 2 * 10) / 10,
        uniqueCode: code,
      },
    });
    console.log(`   Certificate ${cert.uniqueCode}: ${cert.carbonKg}kg`);
  }

  // 3. Create impact actions
  console.log("\n3. Creating impact actions...");
  const impactTypes = ["CARBON", "TREE", "OCEAN"] as const;
  for (let i = 0; i < 10; i++) {
    const type = impactTypes[i % 3];
    const action = await prisma.impactAction.create({
      data: {
        shopId: shop.id,
        type,
        quantity: type === "CARBON" ? Math.round((1 + Math.random() * 5) * 100) / 100 : type === "TREE" ? 1 : 0.5,
        costEur: Math.round((0.1 + Math.random() * 1) * 100) / 100,
        orderId: `TEST-ORDER-${1000 + (i % 5)}`,
      },
    });
    console.log(`   Impact ${action.type}: ${action.quantity} (${action.costEur} EUR)`);
  }

  // 4. Create monthly snapshots
  console.log("\n4. Creating monthly snapshots...");
  const months = ["2026-01", "2026-02", "2026-03"];
  for (const month of months) {
    await prisma.monthlySnapshot.upsert({
      where: { shopId_month: { shopId: shop.id, month } },
      create: {
        shopId: shop.id,
        month,
        totalProducts: 17,
        totalCarbonKg: 140 + Math.round(Math.random() * 20),
        avgCarbonKg: 8 + Math.round(Math.random() * 3),
        countLow: 1,
        countMedium: 14 + Math.floor(Math.random() * 2),
        countHigh: 0,
        countVeryHigh: 1,
        totalOffsetKg: Math.round(Math.random() * 30 * 100) / 100,
        totalTreesPlanted: Math.floor(Math.random() * 10),
        totalOceanKg: Math.round(Math.random() * 5 * 100) / 100,
        totalOffsetEur: Math.round(Math.random() * 20 * 100) / 100,
      },
      update: {},
    });
    console.log(`   Snapshot ${month}: done`);
  }

  // 5. Verify certificate lookup
  console.log("\n5. Testing certificate lookup...");
  const testCert = await prisma.certificate.findFirst({
    where: { shopId: shop.id },
    include: { offset: true, shop: { select: { shopDomain: true, name: true } } },
  });
  if (testCert) {
    console.log(`   Certificate ${testCert.uniqueCode}: OK`);
    console.log(`   Offset: ${testCert.offset.carbonKg}kg, Shop: ${testCert.shop.shopDomain}`);
  }

  // 6. Verify offset with certificate
  console.log("\n6. Testing offset with certificate...");
  const testOffset = await prisma.carbonOffset.findFirst({
    where: { shopId: shop.id },
    include: { certificate: true },
  });
  if (testOffset) {
    console.log(`   Offset ${testOffset.orderId}: ${testOffset.carbonKg}kg`);
    console.log(`   Certificate: ${testOffset.certificate?.uniqueCode ?? "none"}`);
  }

  // 7. Verify impact stats aggregation
  console.log("\n7. Testing impact aggregation...");
  const carbonAgg = await prisma.impactAction.aggregate({
    where: { shopId: shop.id, type: "CARBON" },
    _sum: { quantity: true, costEur: true },
    _count: true,
  });
  const treeAgg = await prisma.impactAction.aggregate({
    where: { shopId: shop.id, type: "TREE" },
    _sum: { quantity: true },
    _count: true,
  });
  const oceanAgg = await prisma.impactAction.aggregate({
    where: { shopId: shop.id, type: "OCEAN" },
    _sum: { quantity: true },
    _count: true,
  });
  console.log(`   Carbon: ${carbonAgg._sum.quantity}kg (${carbonAgg._count} actions)`);
  console.log(`   Trees: ${treeAgg._sum.quantity} (${treeAgg._count} actions)`);
  console.log(`   Ocean: ${oceanAgg._sum.quantity}kg (${oceanAgg._count} actions)`);

  // 8. Verify monthly snapshots
  console.log("\n8. Testing monthly snapshots...");
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { shopId: shop.id },
    orderBy: { month: "asc" },
  });
  for (const s of snapshots) {
    console.log(`   ${s.month}: ${s.totalCarbonKg}kg, offset: ${s.totalOffsetKg}kg, trees: ${s.totalTreesPlanted}`);
  }

  console.log("\n✅ All test data created and verified!");
  console.log("\nNow test these pages:");
  console.log("  - Impact public (should show counters > 0)");
  console.log("  - Analytiques (should show monthly trend)");
  console.log("  - ROI (should show offset revenue)");
  console.log("  - Certificate API: /api/certificate/" + (testCert?.uniqueCode ?? "CODE"));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
