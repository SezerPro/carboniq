-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'GROWTH', 'PRO', 'SCALE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "CarbonLabel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "BadgeStyle" AS ENUM ('PILL', 'LEAF', 'MINIMAL', 'DETAILED');

-- CreateEnum
CREATE TYPE "OffsetStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ImpactType" AS ENUM ('CARBON', 'TREE', 'OCEAN');

-- CreateEnum
CREATE TYPE "ReportPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "planStatus" "PlanStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "badgeStyle" "BadgeStyle" NOT NULL DEFAULT 'PILL',
    "badgeColor" TEXT NOT NULL DEFAULT '#22c55e',
    "badgePosition" TEXT NOT NULL DEFAULT 'below_price',
    "showLabel" BOOLEAN NOT NULL DEFAULT true,
    "locale" TEXT NOT NULL DEFAULT 'auto',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "showComparison" BOOLEAN NOT NULL DEFAULT true,
    "showSocialProof" BOOLEAN NOT NULL DEFAULT true,
    "comparisonStyle" TEXT NOT NULL DEFAULT 'car_km',
    "enableTrees" BOOLEAN NOT NULL DEFAULT false,
    "enableOcean" BOOLEAN NOT NULL DEFAULT false,
    "treeCostEur" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "oceanCostEur" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "carbonCostEur" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "enableOffset" BOOLEAN NOT NULL DEFAULT true,
    "offsetMarkupPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "klaviyoApiKey" TEXT,
    "klaviyoListId" TEXT,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productType" TEXT,
    "tags" TEXT,
    "vendor" TEXT,
    "weightGrams" DOUBLE PRECISION,
    "categoryCode" TEXT,
    "carbonScoreKg" DOUBLE PRECISION,
    "carbonLabel" "CarbonLabel",
    "confidence" DOUBLE PRECISION,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dppMaterials" TEXT,
    "dppOriginCountry" TEXT,
    "dppRecyclability" TEXT,
    "dppQrCodeUrl" TEXT,
    "dppGeneratedAt" TIMESTAMP(3),
    "dppDurabilityYears" DOUBLE PRECISION,
    "dppCareInstructions" TEXT,
    "dppEndOfLife" TEXT,
    "dppCertifications" TEXT,
    "dppRepairabilityIdx" DOUBLE PRECISION,
    "dppSparePartsYears" INTEGER,
    "dppEnergyClass" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmissionFactor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "kgCo2PerKg" DOUBLE PRECISION,
    "kgCo2PerUnit" DOUBLE PRECISION,
    "defaultWeightG" DOUBLE PRECISION,
    "thresholdLow" DOUBLE PRECISION NOT NULL,
    "thresholdMed" DOUBLE PRECISION NOT NULL,
    "thresholdHigh" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmissionFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "status" "PlanStatus" NOT NULL DEFAULT 'TRIALING',
    "shopifyChargeId" TEXT,
    "productLimit" INTEGER NOT NULL DEFAULT 50,
    "productsUsed" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarbonOffset" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "customerEmail" TEXT,
    "carbonKg" DOUBLE PRECISION NOT NULL,
    "amountEur" DOUBLE PRECISION NOT NULL,
    "status" "OffsetStatus" NOT NULL DEFAULT 'PENDING',
    "offsetProvider" TEXT NOT NULL DEFAULT 'internal',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarbonOffset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "offsetId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "orderName" TEXT NOT NULL,
    "carbonKg" DOUBLE PRECISION NOT NULL,
    "treesPlanted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oceanKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueCode" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "pdfUrl" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactAction" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "ImpactType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "costEur" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "totalCarbonKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCarbonKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "countLow" INTEGER NOT NULL DEFAULT 0,
    "countMedium" INTEGER NOT NULL DEFAULT 0,
    "countHigh" INTEGER NOT NULL DEFAULT 0,
    "countVeryHigh" INTEGER NOT NULL DEFAULT 0,
    "totalOffsetKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTreesPlanted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOceanKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOffsetEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReductionTip" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "potentialSaving" DOUBLE PRECISION NOT NULL,
    "potentialSavingPct" DOUBLE PRECISION,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReductionTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSEReport" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "period" "ReportPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dataJson" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RSEReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABTest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "variantA" TEXT NOT NULL,
    "variantB" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trafficSplit" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "winnerVariant" TEXT,
    "impressionsA" INTEGER NOT NULL DEFAULT 0,
    "impressionsB" INTEGER NOT NULL DEFAULT 0,
    "conversionsA" INTEGER NOT NULL DEFAULT 0,
    "conversionsB" INTEGER NOT NULL DEFAULT 0,
    "revenueA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueB" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceScan" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "findings" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "ComplianceScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scope3Entry" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "emissionKg" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "dataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scope3Entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE INDEX "Product_shopId_idx" ON "Product"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_shopifyProductId_key" ON "Product"("shopId", "shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionFactor_code_key" ON "EmissionFactor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shopId_key" ON "Subscription"("shopId");

-- CreateIndex
CREATE INDEX "CarbonOffset_shopId_idx" ON "CarbonOffset"("shopId");

-- CreateIndex
CREATE INDEX "CarbonOffset_orderId_idx" ON "CarbonOffset"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_offsetId_key" ON "Certificate"("offsetId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_uniqueCode_key" ON "Certificate"("uniqueCode");

-- CreateIndex
CREATE INDEX "Certificate_shopId_idx" ON "Certificate"("shopId");

-- CreateIndex
CREATE INDEX "Certificate_uniqueCode_idx" ON "Certificate"("uniqueCode");

-- CreateIndex
CREATE INDEX "ImpactAction_shopId_idx" ON "ImpactAction"("shopId");

-- CreateIndex
CREATE INDEX "ImpactAction_shopId_type_idx" ON "ImpactAction"("shopId", "type");

-- CreateIndex
CREATE INDEX "MonthlySnapshot_shopId_idx" ON "MonthlySnapshot"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySnapshot_shopId_month_key" ON "MonthlySnapshot"("shopId", "month");

-- CreateIndex
CREATE INDEX "ReductionTip_shopId_idx" ON "ReductionTip"("shopId");

-- CreateIndex
CREATE INDEX "RSEReport_shopId_idx" ON "RSEReport"("shopId");

-- CreateIndex
CREATE INDEX "ABTest_shopId_idx" ON "ABTest"("shopId");

-- CreateIndex
CREATE INDEX "ABTest_shopId_isActive_idx" ON "ABTest"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "ComplianceScan_shopId_idx" ON "ComplianceScan"("shopId");

-- CreateIndex
CREATE INDEX "Scope3Entry_shopId_idx" ON "Scope3Entry"("shopId");

-- CreateIndex
CREATE INDEX "Scope3Entry_shopId_category_idx" ON "Scope3Entry"("shopId", "category");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarbonOffset" ADD CONSTRAINT "CarbonOffset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarbonOffset" ADD CONSTRAINT "CarbonOffset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_offsetId_fkey" FOREIGN KEY ("offsetId") REFERENCES "CarbonOffset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAction" ADD CONSTRAINT "ImpactAction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySnapshot" ADD CONSTRAINT "MonthlySnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReductionTip" ADD CONSTRAINT "ReductionTip_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSEReport" ADD CONSTRAINT "RSEReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ABTest" ADD CONSTRAINT "ABTest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceScan" ADD CONSTRAINT "ComplianceScan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scope3Entry" ADD CONSTRAINT "Scope3Entry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
