import prisma from "../../db.server";

export interface ReductionSuggestion {
  category: string;
  title: string;
  description: string;
  potentialSavingPct: number;
  potentialSavingKg: number;
}

interface CategoryAnalysis {
  category: string;
  productCount: number;
  avgScoreKg: number;
  totalScoreKg: number;
  avgWeightKg: number;
  vendorCount: number;
}

function analyzeByCategory(
  products: Array<{
    categoryCode: string | null;
    carbonScoreKg: number | null;
    weightGrams: number | null;
    vendor: string | null;
  }>,
): CategoryAnalysis[] {
  const grouped = new Map<string, typeof products>();

  for (const p of products) {
    const cat = p.categoryCode || "generic.default";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  const analyses: CategoryAnalysis[] = [];
  for (const [category, prods] of grouped) {
    const scores = prods
      .map((p) => p.carbonScoreKg ?? 0)
      .filter((s) => s > 0);
    const weights = prods.map((p) => (p.weightGrams ?? 0) / 1000).filter((w) => w > 0);
    const vendors = new Set(prods.map((p) => p.vendor).filter(Boolean));

    analyses.push({
      category,
      productCount: prods.length,
      avgScoreKg:
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
      totalScoreKg: scores.reduce((a, b) => a + b, 0),
      avgWeightKg:
        weights.length > 0
          ? weights.reduce((a, b) => a + b, 0) / weights.length
          : 0,
      vendorCount: vendors.size,
    });
  }

  return analyses;
}

// Analyze shop products and generate reduction tips
export async function generateReductionTips(
  shopId: string,
): Promise<ReductionSuggestion[]> {
  const products = await prisma.product.findMany({
    where: { shopId },
    select: {
      categoryCode: true,
      carbonScoreKg: true,
      weightGrams: true,
      vendor: true,
    },
  });

  if (products.length === 0) return [];

  const suggestions: ReductionSuggestion[] = [];
  const categoryAnalyses = analyzeByCategory(products);
  const totalEmissions = products.reduce(
    (sum, p) => sum + (p.carbonScoreKg ?? 0),
    0,
  );

  // 1. Packaging optimization: if many products > 1kg CO2
  const highEmissionProducts = products.filter(
    (p) => (p.carbonScoreKg ?? 0) > 1,
  );
  if (highEmissionProducts.length > products.length * 0.3) {
    const savingPct = 15;
    const savingKg = totalEmissions * (savingPct / 100);
    suggestions.push({
      category: "emballage",
      title: "Optimiser les emballages",
      description:
        "Plus de 30% de vos produits dépassent 1 kg CO\u2082e. Passez à des emballages éco-conçus (carton recyclé, suppression du plastique superflu) pour réduire l'empreinte de 10 à 20%.",
      potentialSavingPct: savingPct,
      potentialSavingKg: Math.round(savingKg * 100) / 100,
    });
  }

  // 2. Local sourcing: high transport emissions
  const avgScore =
    totalEmissions / products.filter((p) => (p.carbonScoreKg ?? 0) > 0).length;
  if (avgScore > 3) {
    const savingPct = 22;
    const savingKg = totalEmissions * (savingPct / 100);
    suggestions.push({
      category: "transport",
      title: "Privilégier l'approvisionnement local",
      description:
        "Votre empreinte moyenne par produit est élevée. Réduisez les distances de transport en sourçant auprès de fournisseurs européens ou locaux (-15 à 30% d'émissions transport).",
      potentialSavingPct: savingPct,
      potentialSavingKg: Math.round(savingKg * 100) / 100,
    });
  }

  // 3. Material substitution for textile products
  for (const analysis of categoryAnalyses) {
    const catLower = analysis.category.toLowerCase();

    if (
      catLower.includes("textile") ||
      catLower.includes("vêtement") ||
      catLower.includes("clothing")
    ) {
      const savingPct = 30;
      const savingKg = analysis.totalScoreKg * (savingPct / 100);
      suggestions.push({
        category: "matériaux",
        title: "Adopter des matériaux recyclés (textile)",
        description:
          `Vos ${analysis.productCount} produits textiles représentent ${analysis.totalScoreKg.toFixed(1)} kg CO\u2082e. Le coton biologique et le polyester recyclé réduisent l'empreinte de 20 à 40%.`,
        potentialSavingPct: savingPct,
        potentialSavingKg: Math.round(savingKg * 100) / 100,
      });
    }

    // Electronics-specific
    if (
      catLower.includes("électronique") ||
      catLower.includes("electronics")
    ) {
      const savingPct = 20;
      const savingKg = analysis.totalScoreKg * (savingPct / 100);
      suggestions.push({
        category: "économie_circulaire",
        title: "Proposer un programme de reconditionnement",
        description:
          `Pour vos ${analysis.productCount} produits électroniques, mettez en place un programme de reprise et reconditionnement, et fournissez des guides de réparation.`,
        potentialSavingPct: savingPct,
        potentialSavingKg: Math.round(savingKg * 100) / 100,
      });
    }

    // Food-specific
    if (catLower.includes("alimentaire") || catLower.includes("food")) {
      const savingPct = 25;
      const savingKg = analysis.totalScoreKg * (savingPct / 100);
      suggestions.push({
        category: "saisonnalité",
        title: "Sourcer des ingrédients de saison et locaux",
        description:
          "Privilégiez les ingrédients de saison et locaux pour réduire l'empreinte liée au transport et au stockage réfrigéré.",
        potentialSavingPct: savingPct,
        potentialSavingKg: Math.round(savingKg * 100) / 100,
      });
    }

    // Furniture-specific
    if (catLower.includes("meuble") || catLower.includes("furniture")) {
      const savingPct = 25;
      const savingKg = analysis.totalScoreKg * (savingPct / 100);
      suggestions.push({
        category: "matériaux",
        title: "Utiliser du bois certifié FSC et le design flat-pack",
        description:
          "Le bois certifié FSC et un design flat-pack réduisent l'empreinte de fabrication et de transport de vos meubles.",
        potentialSavingPct: savingPct,
        potentialSavingKg: Math.round(savingKg * 100) / 100,
      });
    }
  }

  // 4. Weight reduction
  const heavyProducts = products.filter((p) => (p.weightGrams ?? 0) > 2000);
  if (heavyProducts.length > 3) {
    const heavyEmissions = heavyProducts.reduce(
      (sum, p) => sum + (p.carbonScoreKg ?? 0),
      0,
    );
    const savingPct = 12;
    const savingKg = heavyEmissions * (savingPct / 100);
    suggestions.push({
      category: "poids",
      title: "Réduire le poids des produits",
      description:
        `${heavyProducts.length} produits pèsent plus de 2 kg. Étudiez des alternatives plus légères ou des matériaux allégés pour réduire l'empreinte transport.`,
      potentialSavingPct: savingPct,
      potentialSavingKg: Math.round(savingKg * 100) / 100,
    });
  }

  // 5. Supplier consolidation
  const uniqueVendors = new Set(products.map((p) => p.vendor).filter(Boolean));
  if (uniqueVendors.size > 5) {
    const savingPct = 10;
    const savingKg = totalEmissions * (savingPct / 100);
    suggestions.push({
      category: "logistique",
      title: "Consolider les fournisseurs",
      description:
        `Vous travaillez avec ${uniqueVendors.size} fournisseurs différents. Regrouper les commandes et réduire le nombre de fournisseurs diminue les émissions logistiques de 5 à 15%.`,
      potentialSavingPct: savingPct,
      potentialSavingKg: Math.round(savingKg * 100) / 100,
    });
  }

  // 6. Product grouping / bundling
  if (products.length > 10) {
    const savingPct = 8;
    const savingKg = totalEmissions * (savingPct / 100);
    suggestions.push({
      category: "emballage",
      title: "Proposer des lots de produits",
      description:
        "Avec plus de 10 produits, proposez des bundles pour réduire l'emballage individuel et les expéditions séparées.",
      potentialSavingPct: savingPct,
      potentialSavingKg: Math.round(savingKg * 100) / 100,
    });
  }

  // Sort by potential saving descending
  suggestions.sort((a, b) => b.potentialSavingKg - a.potentialSavingKg);

  // Store tips in database
  // Clear existing non-applied tips first
  await prisma.reductionTip.deleteMany({
    where: { shopId, isApplied: false },
  });

  for (const tip of suggestions) {
    await prisma.reductionTip.create({
      data: {
        shopId,
        category: tip.category,
        title: tip.title,
        description: tip.description,
        potentialSaving: tip.potentialSavingKg,
        potentialSavingPct: tip.potentialSavingPct,
        isApplied: false,
      },
    });
  }

  return suggestions;
}

// Get current tips for a shop
export async function getReductionTips(shopId: string) {
  return prisma.reductionTip.findMany({
    where: { shopId },
    orderBy: { potentialSaving: "desc" },
  });
}

// Mark a tip as applied
export async function markTipApplied(tipId: string) {
  return prisma.reductionTip.update({
    where: { id: tipId },
    data: { isApplied: true, appliedAt: new Date() },
  });
}
