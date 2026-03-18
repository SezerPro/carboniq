import type { EmissionFactor, CarbonLabel } from "@prisma/client";
import prisma from "../../db.server";

// ── Levenshtein distance ───────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array(lb + 1).fill(0),
  );

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[la][lb];
}

/** Normalized similarity between 0 and 1 (1 = identical) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ── Types ──────────────────────────────────────────────

interface ProductInput {
  id: string;
  title: string;
  product_type?: string | null;
  tags?: string | null;
  vendor?: string | null;
  weight?: number | null; // in grams
}

interface MatchResult {
  factor: EmissionFactor;
  confidence: number;
}

interface CarbonResult {
  carbonScoreKg: number;
  carbonLabel: CarbonLabel;
  confidence: number;
  categoryCode: string;
}

// ── findBestFactor ─────────────────────────────────────

export async function findBestFactor(
  product: ProductInput,
): Promise<MatchResult> {
  const factors = await prisma.emissionFactor.findMany();

  // Build a searchable string from the product
  const searchTerms = [
    product.title,
    product.product_type,
    product.tags,
    product.vendor,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let bestFactor: EmissionFactor | null = null;
  let bestScore = 0;

  for (const factor of factors) {
    if (factor.code === "generic.default") continue;

    const keywords: string[] = JSON.parse(factor.keywords);
    let factorBestScore = 0;

    for (const keyword of keywords) {
      const kw = keyword.toLowerCase();

      // Exact substring match = high confidence
      if (searchTerms.includes(kw)) {
        factorBestScore = Math.max(factorBestScore, 0.9);
        continue;
      }

      // Levenshtein similarity against each word in the search terms
      const words = searchTerms.split(/[\s,;|]+/);
      for (const word of words) {
        if (word.length < 2) continue;
        const sim = similarity(kw, word);
        factorBestScore = Math.max(factorBestScore, sim);
      }
    }

    if (factorBestScore > bestScore) {
      bestScore = factorBestScore;
      bestFactor = factor;
    }
  }

  // Fallback to generic.default if no good match
  if (!bestFactor || bestScore < 0.2) {
    const fallback = factors.find((f) => f.code === "generic.default");
    if (!fallback) throw new Error("Missing generic.default emission factor");
    return { factor: fallback, confidence: fallback.confidence };
  }

  return {
    factor: bestFactor,
    confidence: Math.round(bestScore * bestFactor.confidence * 100) / 100,
  };
}

// ── computeCarbonKg ────────────────────────────────────

export function computeCarbonKg(
  product: ProductInput,
  factor: EmissionFactor,
): number {
  // Per-unit factor (e.g. electronics)
  if (factor.kgCo2PerUnit != null) {
    return factor.kgCo2PerUnit;
  }

  // Per-kg factor — resolve weight with fallbacks
  const weightGrams =
    product.weight ?? factor.defaultWeightG ?? 500;
  const weightKg = weightGrams / 1000;

  return Math.round(factor.kgCo2PerKg! * weightKg * 100) / 100;
}

// ── computeLabel ───────────────────────────────────────

export function computeLabel(
  carbonKg: number,
  factor: EmissionFactor,
): CarbonLabel {
  if (carbonKg <= factor.thresholdLow) return "LOW";
  if (carbonKg <= factor.thresholdMed) return "MEDIUM";
  if (carbonKg <= factor.thresholdHigh) return "HIGH";
  return "VERY_HIGH";
}

// ── calculateAndSave ───────────────────────────────────

export async function calculateAndSave(
  shopId: string,
  product: ProductInput,
): Promise<CarbonResult> {
  const { factor, confidence } = await findBestFactor(product);
  const carbonScoreKg = computeCarbonKg(product, factor);
  const carbonLabel = computeLabel(carbonScoreKg, factor);

  await prisma.product.upsert({
    where: {
      shopId_shopifyProductId: {
        shopId,
        shopifyProductId: product.id,
      },
    },
    create: {
      shopId,
      shopifyProductId: product.id,
      title: product.title,
      productType: product.product_type ?? null,
      tags: product.tags ?? null,
      vendor: product.vendor ?? null,
      weightGrams: product.weight ?? null,
      categoryCode: factor.code,
      carbonScoreKg,
      carbonLabel,
      confidence,
      calculatedAt: new Date(),
    },
    update: {
      title: product.title,
      productType: product.product_type ?? null,
      tags: product.tags ?? null,
      vendor: product.vendor ?? null,
      weightGrams: product.weight ?? null,
      categoryCode: factor.code,
      carbonScoreKg,
      carbonLabel,
      confidence,
      calculatedAt: new Date(),
    },
  });

  return {
    carbonScoreKg,
    carbonLabel,
    confidence,
    categoryCode: factor.code,
  };
}
