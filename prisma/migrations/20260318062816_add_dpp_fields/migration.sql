-- AlterTable
ALTER TABLE "Product" ADD COLUMN "dppCareInstructions" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppCertifications" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppDurabilityYears" REAL;
ALTER TABLE "Product" ADD COLUMN "dppEndOfLife" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppEnergyClass" TEXT;
ALTER TABLE "Product" ADD COLUMN "dppRepairabilityIdx" REAL;
ALTER TABLE "Product" ADD COLUMN "dppSparePartsYears" INTEGER;
