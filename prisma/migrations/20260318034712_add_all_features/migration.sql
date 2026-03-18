-- AlterTable
ALTER TABLE "Product" ADD COLUMN "dppGeneratedAt" DATETIME;
ALTER TABLE "Product" ADD COLUMN "dppMaterials" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppOriginCountry" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppQrCodeUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppRecyclability" TEXT;

-- CreateTable
CREATE TABLE "CarbonOffset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "customerEmail" TEXT,
    "carbonKg" REAL NOT NULL,
    "amountEur" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "offsetProvider" TEXT NOT NULL DEFAULT 'internal',
    "providerRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CarbonOffset_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CarbonOffset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "offsetId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT,
    "orderName" TEXT NOT NULL,
    "carbonKg" REAL NOT NULL,
    "treesPlanted" REAL NOT NULL DEFAULT 0,
    "oceanKg" REAL NOT NULL DEFAULT 0,
    "uniqueCode" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "pdfUrl" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Certificate_offsetId_fkey" FOREIGN KEY ("offsetId") REFERENCES "CarbonOffset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpactAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "costEur" REAL NOT NULL,
    "orderId" TEXT,
    "providerRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactAction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalProducts" INTEGER NOT NULL DEFAULT 0,
    "totalCarbonKg" REAL NOT NULL DEFAULT 0,
    "avgCarbonKg" REAL NOT NULL DEFAULT 0,
    "countLow" INTEGER NOT NULL DEFAULT 0,
    "countMedium" INTEGER NOT NULL DEFAULT 0,
    "countHigh" INTEGER NOT NULL DEFAULT 0,
    "countVeryHigh" INTEGER NOT NULL DEFAULT 0,
    "totalOffsetKg" REAL NOT NULL DEFAULT 0,
    "totalTreesPlanted" REAL NOT NULL DEFAULT 0,
    "totalOceanKg" REAL NOT NULL DEFAULT 0,
    "totalOffsetEur" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlySnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReductionTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "potentialSaving" REAL NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReductionTip_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RSEReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "dataJson" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RSEReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "planStatus" TEXT NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" DATETIME,
    "badgeStyle" TEXT NOT NULL DEFAULT 'PILL',
    "badgeColor" TEXT NOT NULL DEFAULT '#22c55e',
    "badgePosition" TEXT NOT NULL DEFAULT 'below_price',
    "showLabel" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "showComparison" BOOLEAN NOT NULL DEFAULT true,
    "showSocialProof" BOOLEAN NOT NULL DEFAULT true,
    "comparisonStyle" TEXT NOT NULL DEFAULT 'car_km',
    "enableTrees" BOOLEAN NOT NULL DEFAULT false,
    "enableOcean" BOOLEAN NOT NULL DEFAULT false,
    "treeCostEur" REAL NOT NULL DEFAULT 0.40,
    "oceanCostEur" REAL NOT NULL DEFAULT 0.05,
    "carbonCostEur" REAL NOT NULL DEFAULT 0.01,
    "enableOffset" BOOLEAN NOT NULL DEFAULT true,
    "offsetMarkupPct" REAL NOT NULL DEFAULT 0,
    "klaviyoApiKey" TEXT,
    "klaviyoListId" TEXT
);
INSERT INTO "new_Shop" ("accessToken", "badgeColor", "badgePosition", "badgeStyle", "email", "id", "installedAt", "name", "plan", "planStatus", "shopDomain", "showLabel", "trialEndsAt", "updatedAt") SELECT "accessToken", "badgeColor", "badgePosition", "badgeStyle", "email", "id", "installedAt", "name", "plan", "planStatus", "shopDomain", "showLabel", "trialEndsAt", "updatedAt" FROM "Shop";
DROP TABLE "Shop";
ALTER TABLE "new_Shop" RENAME TO "Shop";
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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
