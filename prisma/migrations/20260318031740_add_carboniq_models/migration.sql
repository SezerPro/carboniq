-- CreateTable
CREATE TABLE "Shop" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productType" TEXT,
    "tags" TEXT,
    "vendor" TEXT,
    "weightGrams" REAL,
    "categoryCode" TEXT,
    "carbonScoreKg" REAL,
    "carbonLabel" TEXT,
    "confidence" REAL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "calculatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmissionFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "kgCo2PerKg" REAL,
    "kgCo2PerUnit" REAL,
    "defaultWeightG" REAL,
    "thresholdLow" REAL NOT NULL,
    "thresholdMed" REAL NOT NULL,
    "thresholdHigh" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.7,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "status" TEXT NOT NULL DEFAULT 'TRIALING',
    "shopifyChargeId" TEXT,
    "productLimit" INTEGER NOT NULL DEFAULT 50,
    "productsUsed" INTEGER NOT NULL DEFAULT 0,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
