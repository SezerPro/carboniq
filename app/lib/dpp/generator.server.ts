import prisma from "../../db.server";

export interface DPPData {
  productIdentification: {
    shopifyProductId: string;
    title: string;
    vendor: string;
    category: string;
  };
  environmentalFootprint: {
    carbonScoreKg: number;
    carbonLabel: string;
    methodology: string;
    calculatedAt: string;
  };
  materialsComposition: {
    materials: Array<{ name: string; percentage: number; recycled: boolean }>;
    source: "declared" | "estimated";
  };
  origin: {
    country: string;
    countryCode: string;
  };
  recyclability: {
    score: string;
    instructions: string;
  };
  methodology: {
    standard: string;
    database: string;
    version: string;
  };
  qrCodeUrl: string;
  generatedAt: string;
}

function getCarbonLabel(scoreKg: number): string {
  if (scoreKg <= 1) return "A";
  if (scoreKg <= 3) return "B";
  if (scoreKg <= 6) return "C";
  if (scoreKg <= 10) return "D";
  return "E";
}

function estimateMaterialsFromCategory(
  category: string,
): Array<{ name: string; percentage: number; recycled: boolean }> {
  const categoryLower = category.toLowerCase();

  if (
    categoryLower.includes("textile") ||
    categoryLower.includes("vêtement") ||
    categoryLower.includes("clothing")
  ) {
    return [
      { name: "Coton", percentage: 60, recycled: false },
      { name: "Polyester", percentage: 35, recycled: false },
      { name: "Élasthanne", percentage: 5, recycled: false },
    ];
  }

  if (
    categoryLower.includes("électronique") ||
    categoryLower.includes("electronics")
  ) {
    return [
      { name: "Plastique ABS", percentage: 40, recycled: false },
      { name: "Métaux", percentage: 30, recycled: false },
      { name: "Composants électroniques", percentage: 25, recycled: false },
      { name: "Verre", percentage: 5, recycled: false },
    ];
  }

  if (
    categoryLower.includes("meuble") ||
    categoryLower.includes("furniture")
  ) {
    return [
      { name: "Bois", percentage: 70, recycled: false },
      { name: "Métal", percentage: 20, recycled: false },
      { name: "Textile", percentage: 10, recycled: false },
    ];
  }

  if (
    categoryLower.includes("alimentaire") ||
    categoryLower.includes("food")
  ) {
    return [
      { name: "Ingrédients naturels", percentage: 85, recycled: false },
      { name: "Emballage carton", percentage: 10, recycled: true },
      { name: "Emballage plastique", percentage: 5, recycled: false },
    ];
  }

  return [
    { name: "Matériaux mixtes", percentage: 80, recycled: false },
    { name: "Emballage", percentage: 20, recycled: false },
  ];
}

function getRecyclabilityInfo(category: string): {
  score: string;
  instructions: string;
} {
  const categoryLower = category.toLowerCase();

  if (
    categoryLower.includes("textile") ||
    categoryLower.includes("clothing")
  ) {
    return {
      score: "Recyclable",
      instructions:
        "Déposez dans un point de collecte textile ou conteneur dédié. Ne jetez pas à la poubelle.",
    };
  }

  if (categoryLower.includes("électronique") || categoryLower.includes("electronics")) {
    return {
      score: "Recyclable (DEEE)",
      instructions:
        "Rapportez en magasin ou en déchetterie pour recyclage des équipements électriques et électroniques.",
    };
  }

  if (categoryLower.includes("meuble") || categoryLower.includes("furniture")) {
    return {
      score: "Partiellement recyclable",
      instructions:
        "Déposez en déchetterie. Le bois et le métal seront séparés pour recyclage.",
    };
  }

  return {
    score: "Vérifiez les consignes locales",
    instructions:
      "Consultez les consignes de tri de votre commune pour un recyclage adapté.",
  };
}

// Generate DPP data for a product
export async function generateDPP(productId: string): Promise<DPPData> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      emissionFactor: true,
      shop: true,
    },
  });

  const category = product.category || "Produit général";
  const carbonScoreKg = product.carbonScoreKg ?? 0;

  // Build materials from DPP fields or estimate from category
  let materials: Array<{ name: string; percentage: number; recycled: boolean }>;
  let materialsSource: "declared" | "estimated";

  if (product.dppMaterials) {
    try {
      materials = JSON.parse(product.dppMaterials as string);
      materialsSource = "declared";
    } catch {
      materials = estimateMaterialsFromCategory(category);
      materialsSource = "estimated";
    }
  } else {
    materials = estimateMaterialsFromCategory(category);
    materialsSource = "estimated";
  }

  const originCountry = product.dppOriginCountry || "Non spécifié";
  const recyclability =
    product.dppRecyclability
      ? {
          score: product.dppRecyclability,
          instructions: "Consultez les consignes locales.",
        }
      : getRecyclabilityInfo(category);

  const shopDomain = product.shop?.shopifyDomain || "shop";
  const qrCodeUrl = `/api/dpp/${product.id}?shop=${encodeURIComponent(shopDomain)}`;

  const dppData: DPPData = {
    productIdentification: {
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      vendor: product.vendor || "Non spécifié",
      category,
    },
    environmentalFootprint: {
      carbonScoreKg,
      carbonLabel: getCarbonLabel(carbonScoreKg),
      methodology: product.emissionFactor?.methodology || "ADEME Base Carbone",
      calculatedAt: product.scoredAt?.toISOString() || new Date().toISOString(),
    },
    materialsComposition: {
      materials,
      source: materialsSource,
    },
    origin: {
      country: originCountry,
      countryCode: originCountry.substring(0, 2).toUpperCase(),
    },
    recyclability,
    methodology: {
      standard: "GHG Protocol Product Life Cycle",
      database: "ADEME Base Carbone v24",
      version: "1.0",
    },
    qrCodeUrl,
    generatedAt: new Date().toISOString(),
  };

  // Update product with DPP fields
  await prisma.product.update({
    where: { id: productId },
    data: {
      dppGeneratedAt: new Date(),
      dppQrCodeUrl: qrCodeUrl,
    },
  });

  return dppData;
}

// Generate DPP for all products in a shop
export async function generateAllDPPs(
  shopId: string,
): Promise<{ count: number; errors: string[] }> {
  const products = await prisma.product.findMany({
    where: { shopId },
  });

  let count = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      await generateDPP(product.id);
      count++;
    } catch (error) {
      errors.push(
        `Produit ${product.title}: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      );
    }
  }

  return { count, errors };
}

// Get DPP data for public display
export async function getDPPData(
  shopDomain: string,
  productId: string,
): Promise<DPPData | null> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shop: { shopifyDomain: shopDomain },
    },
    include: {
      emissionFactor: true,
      shop: true,
    },
  });

  if (!product) return null;

  const category = product.category || "Produit général";
  const carbonScoreKg = product.carbonScoreKg ?? 0;

  let materials: Array<{ name: string; percentage: number; recycled: boolean }>;
  let materialsSource: "declared" | "estimated";

  if (product.dppMaterials) {
    try {
      materials = JSON.parse(product.dppMaterials as string);
      materialsSource = "declared";
    } catch {
      materials = estimateMaterialsFromCategory(category);
      materialsSource = "estimated";
    }
  } else {
    materials = estimateMaterialsFromCategory(category);
    materialsSource = "estimated";
  }

  const originCountry = product.dppOriginCountry || "Non spécifié";
  const recyclability =
    product.dppRecyclability
      ? {
          score: product.dppRecyclability,
          instructions: "Consultez les consignes locales.",
        }
      : getRecyclabilityInfo(category);

  return {
    productIdentification: {
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      vendor: product.vendor || "Non spécifié",
      category,
    },
    environmentalFootprint: {
      carbonScoreKg,
      carbonLabel: getCarbonLabel(carbonScoreKg),
      methodology: product.emissionFactor?.methodology || "ADEME Base Carbone",
      calculatedAt: product.scoredAt?.toISOString() || new Date().toISOString(),
    },
    materialsComposition: {
      materials,
      source: materialsSource,
    },
    origin: {
      country: originCountry,
      countryCode: originCountry.substring(0, 2).toUpperCase(),
    },
    recyclability,
    methodology: {
      standard: "GHG Protocol Product Life Cycle",
      database: "ADEME Base Carbone v24",
      version: "1.0",
    },
    qrCodeUrl: product.dppQrCodeUrl || "",
    generatedAt:
      product.dppGeneratedAt?.toISOString() || new Date().toISOString(),
  };
}
