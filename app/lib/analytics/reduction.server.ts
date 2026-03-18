import prisma from "../../db.server";

// ── Types ──────────────────────────────────────────────

interface ReductionTipData {
  id: string;
  shopId: string;
  category: string;
  title: string;
  description: string;
  potentialSaving: number;
  isApplied: boolean;
  appliedAt: Date | null;
  createdAt: Date;
}

export interface ReductionProgress {
  totalTips: number;
  appliedTips: number;
  estimatedSavingKg: number;
  achievedSavingKg: number;
}

// ── Tip templates per category ─────────────────────────

interface TipTemplate {
  category: string;
  title: string;
  descriptionTemplate: string;
  savingPct: number;
}

const TIP_TEMPLATES: TipTemplate[] = [
  {
    category: "packaging",
    title: "Packaging recyclé",
    descriptionTemplate:
      "Passez à un packaging recyclé pour vos {count} produits {categoryLabel} → -{pct}% CO₂ estimé",
    savingPct: 15,
  },
  {
    category: "sourcing",
    title: "Fournisseur local",
    descriptionTemplate:
      "Privilégiez un fournisseur local pour {categoryLabel} → -{pct}% CO₂ sur le transport",
    savingPct: 20,
  },
  {
    category: "weight",
    title: "Réduction du poids d'emballage",
    descriptionTemplate:
      "Réduisez le poids d'emballage de vos {categoryLabel} → -{pct}% CO₂",
    savingPct: 10,
  },
  {
    category: "material",
    title: "Matériaux recyclés",
    descriptionTemplate:
      "Utilisez des matériaux recyclés pour {categoryLabel} → -{pct}% CO₂",
    savingPct: 25,
  },
];

// ── generateReductionTips ──────────────────────────────

export async function generateReductionTips(
  shopId: string,
): Promise<ReductionTipData[]> {
  // Fetch products with HIGH or VERY_HIGH labels
  const problematicProducts = await prisma.product.findMany({
    where: {
      shopId,
      carbonLabel: { in: ["HIGH", "VERY_HIGH"] },
      carbonScoreKg: { not: null },
    },
    select: {
      id: true,
      categoryCode: true,
      carbonScoreKg: true,
      carbonLabel: true,
    },
  });

  if (problematicProducts.length === 0) {
    return getShopTips(shopId);
  }

  // Group by categoryCode
  const categoryGroups: Record<
    string,
    { count: number; totalCarbonKg: number }
  > = {};
  for (const p of problematicProducts) {
    const cat = p.categoryCode ?? "general";
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = { count: 0, totalCarbonKg: 0 };
    }
    categoryGroups[cat].count++;
    categoryGroups[cat].totalCarbonKg += p.carbonScoreKg ?? 0;
  }

  // Generate tips for each problematic category
  const tipsToUpsert: Array<{
    category: string;
    title: string;
    description: string;
    potentialSaving: number;
  }> = [];

  for (const [categoryCode, data] of Object.entries(categoryGroups)) {
    const categoryLabel = categoryCode === "general" ? "produits" : categoryCode;

    for (const template of TIP_TEMPLATES) {
      const description = template.descriptionTemplate
        .replace("{count}", String(data.count))
        .replace("{categoryLabel}", categoryLabel)
        .replace("{pct}", String(template.savingPct));

      const potentialSaving =
        Math.round(data.totalCarbonKg * (template.savingPct / 100) * 100) / 100;

      tipsToUpsert.push({
        category: template.category,
        title: `${template.title} — ${categoryLabel}`,
        description,
        potentialSaving,
      });
    }
  }

  // Upsert each tip (match on shopId + category + title to avoid duplicates)
  for (const tip of tipsToUpsert) {
    const existing = await prisma.reductionTip.findFirst({
      where: {
        shopId,
        category: tip.category,
        title: tip.title,
      },
    });

    if (existing) {
      await prisma.reductionTip.update({
        where: { id: existing.id },
        data: {
          description: tip.description,
          potentialSaving: tip.potentialSaving,
        },
      });
    } else {
      await prisma.reductionTip.create({
        data: {
          shopId,
          category: tip.category,
          title: tip.title,
          description: tip.description,
          potentialSaving: tip.potentialSaving,
        },
      });
    }
  }

  return getShopTips(shopId);
}

// ── markTipApplied ─────────────────────────────────────

export async function markTipApplied(tipId: string) {
  const tip = await prisma.reductionTip.update({
    where: { id: tipId },
    data: {
      isApplied: true,
      appliedAt: new Date(),
    },
  });

  return tip;
}

// ── getShopTips ────────────────────────────────────────

export async function getShopTips(
  shopId: string,
): Promise<ReductionTipData[]> {
  const tips = await prisma.reductionTip.findMany({
    where: { shopId },
    orderBy: { potentialSaving: "desc" },
  });

  return tips;
}

// ── getReductionProgress ───────────────────────────────

export async function getReductionProgress(
  shopId: string,
): Promise<ReductionProgress> {
  const tips = await prisma.reductionTip.findMany({
    where: { shopId },
    select: {
      potentialSaving: true,
      isApplied: true,
    },
  });

  const totalTips = tips.length;
  const appliedTips = tips.filter((t) => t.isApplied).length;
  const estimatedSavingKg = tips.reduce(
    (sum, t) => sum + t.potentialSaving,
    0,
  );
  const achievedSavingKg = tips
    .filter((t) => t.isApplied)
    .reduce((sum, t) => sum + t.potentialSaving, 0);

  return {
    totalTips,
    appliedTips,
    estimatedSavingKg: Math.round(estimatedSavingKg * 100) / 100,
    achievedSavingKg: Math.round(achievedSavingKg * 100) / 100,
  };
}
