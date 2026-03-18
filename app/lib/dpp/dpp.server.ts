import prisma from "../../db.server";

/**
 * Generate a Digital Product Passport (EU-ESPR-2024/1781) for a single product.
 */
export async function generateDPP(productId: string) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { shop: true },
  });

  const factor = product.categoryCode
    ? await prisma.emissionFactor.findUnique({
        where: { code: product.categoryCode },
      })
    : null;

  const dppData = {
    version: "1.0",
    standard: "EU-ESPR-2024/1781",
    product: {
      title: product.title,
      type: product.productType,
      vendor: product.vendor,
      weight: product.weightGrams,
    },
    environmental: {
      carbonFootprintKg: product.carbonScoreKg,
      carbonLabel: product.carbonLabel,
      methodology: factor ? `${factor.source} / Base Carbone` : "Base Carbone",
      calculatedAt: product.calculatedAt,
      confidence: product.confidence,
    },
    materials: product.dppMaterials
      ? JSON.parse(product.dppMaterials)
      : null,
    originCountry: product.dppOriginCountry,
    recyclability: product.dppRecyclability,
    issuer: {
      app: "Carboniq",
      shop: product.shop.shopDomain,
    },
    issuedAt: new Date().toISOString(),
  };

  const qrCodeUrl = `/api/dpp/${product.id}`;

  await prisma.product.update({
    where: { id: product.id },
    data: {
      dppQrCodeUrl: qrCodeUrl,
      dppGeneratedAt: new Date(),
    },
  });

  return dppData;
}

/**
 * Generate DPPs for every product in a shop. Returns the count generated.
 */
export async function generateShopDPPs(shopId: string): Promise<number> {
  const products = await prisma.product.findMany({
    where: { shopId },
    select: { id: true },
  });

  let count = 0;
  for (const product of products) {
    await generateDPP(product.id);
    count++;
  }

  return count;
}

/**
 * Read the existing DPP data for a product (without regenerating).
 */
export async function getDPPData(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { shop: true },
  });

  if (!product) return null;

  const factor = product.categoryCode
    ? await prisma.emissionFactor.findUnique({
        where: { code: product.categoryCode },
      })
    : null;

  return {
    version: "1.0",
    standard: "EU-ESPR-2024/1781",
    product: {
      title: product.title,
      type: product.productType,
      vendor: product.vendor,
      weight: product.weightGrams,
    },
    environmental: {
      carbonFootprintKg: product.carbonScoreKg,
      carbonLabel: product.carbonLabel,
      methodology: factor ? `${factor.source} / Base Carbone` : "Base Carbone",
      calculatedAt: product.calculatedAt,
      confidence: product.confidence,
    },
    materials: product.dppMaterials
      ? JSON.parse(product.dppMaterials)
      : null,
    originCountry: product.dppOriginCountry,
    recyclability: product.dppRecyclability,
    issuer: {
      app: "Carboniq",
      shop: product.shop.shopDomain,
    },
    issuedAt: product.dppGeneratedAt?.toISOString() ?? null,
  };
}
