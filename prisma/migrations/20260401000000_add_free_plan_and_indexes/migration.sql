-- AlterEnum: Add FREE to Plan
ALTER TYPE "Plan" ADD VALUE 'FREE';

-- AlterTable: Change default plan to FREE
ALTER TABLE "Shop" ALTER COLUMN "plan" SET DEFAULT 'FREE';
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'FREE';

-- CreateTable: ReductionGoal (if not exists)
CREATE TABLE IF NOT EXISTS "ReductionGoal" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "targetPct" DOUBLE PRECISION NOT NULL,
    "baselineCo2Kg" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReductionGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CarbonOffset_shopId_status_idx" ON "CarbonOffset"("shopId", "status");
CREATE INDEX IF NOT EXISTS "EmissionFactor_category_idx" ON "EmissionFactor"("category");
CREATE INDEX IF NOT EXISTS "Product_categoryCode_idx" ON "Product"("categoryCode");
CREATE INDEX IF NOT EXISTS "ReductionGoal_shopId_idx" ON "ReductionGoal"("shopId");
CREATE INDEX IF NOT EXISTS "Session_shop_idx" ON "Session"("shop");

-- AddForeignKey (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ReductionGoal_shopId_fkey'
    ) THEN
        ALTER TABLE "ReductionGoal" ADD CONSTRAINT "ReductionGoal_shopId_fkey"
            FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
