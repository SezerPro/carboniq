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
    "locale" TEXT NOT NULL DEFAULT 'auto',
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
INSERT INTO "new_Shop" ("accessToken", "badgeColor", "badgePosition", "badgeStyle", "carbonCostEur", "comparisonStyle", "email", "enableOcean", "enableOffset", "enableTrees", "id", "installedAt", "klaviyoApiKey", "klaviyoListId", "name", "oceanCostEur", "offsetMarkupPct", "plan", "planStatus", "shopDomain", "showComparison", "showLabel", "showSocialProof", "treeCostEur", "trialEndsAt", "updatedAt") SELECT "accessToken", "badgeColor", "badgePosition", "badgeStyle", "carbonCostEur", "comparisonStyle", "email", "enableOcean", "enableOffset", "enableTrees", "id", "installedAt", "klaviyoApiKey", "klaviyoListId", "name", "oceanCostEur", "offsetMarkupPct", "plan", "planStatus", "shopDomain", "showComparison", "showLabel", "showSocialProof", "treeCostEur", "trialEndsAt", "updatedAt" FROM "Shop";
DROP TABLE "Shop";
ALTER TABLE "new_Shop" RENAME TO "Shop";
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
