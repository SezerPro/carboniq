/**
 * One-shot migration script: convert shops with plan=STARTER + status=CANCELED to plan=FREE.
 * Run once after deploying the FREE enum: npx tsx prisma/migrate-free-plan.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Migrate shops
  const shops = await prisma.shop.updateMany({
    where: { plan: "STARTER", planStatus: "CANCELED" },
    data: { plan: "FREE" },
  });
  console.log(`Migrated ${shops.count} shops to FREE plan`);

  // Migrate subscriptions
  const subs = await prisma.subscription.updateMany({
    where: { plan: "STARTER", status: "CANCELED" },
    data: { plan: "FREE" },
  });
  console.log(`Migrated ${subs.count} subscriptions to FREE plan`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
