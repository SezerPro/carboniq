-- CreateTable
CREATE TABLE "ABTest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "variantA" TEXT NOT NULL,
    "variantB" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trafficSplit" REAL NOT NULL DEFAULT 0.5,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "winnerVariant" TEXT,
    "impressionsA" INTEGER NOT NULL DEFAULT 0,
    "impressionsB" INTEGER NOT NULL DEFAULT 0,
    "conversionsA" INTEGER NOT NULL DEFAULT 0,
    "conversionsB" INTEGER NOT NULL DEFAULT 0,
    "revenueA" REAL NOT NULL DEFAULT 0,
    "revenueB" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ABTest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "totalIssues" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "findings" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "ComplianceScan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scope3Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "emissionKg" REAL NOT NULL,
    "period" TEXT NOT NULL,
    "dataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scope3Entry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
