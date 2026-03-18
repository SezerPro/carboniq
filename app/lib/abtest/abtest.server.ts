import prisma from "../../db.server";

// ── Types ──────────────────────────────────────────────

export type TestType =
  | "badge_style"
  | "offset_placement"
  | "messaging"
  | "equivalence";

export interface TestResults {
  impressionsA: number;
  impressionsB: number;
  conversionsA: number;
  conversionsB: number;
  revenueA: number;
  revenueB: number;
  conversionRateA: number;
  conversionRateB: number;
  revenuePerImpressionA: number;
  revenuePerImpressionB: number;
  zScore: number;
  isSignificant: boolean;
  recommendedWinner: "A" | "B" | null;
}

// ── Create a new A/B test ──────────────────────────────

export async function createABTest(
  shopId: string,
  name: string,
  testType: TestType,
  variantA: string,
  variantB: string,
  trafficSplit: number = 0.5,
) {
  // Deactivate any existing active test of the same type
  await prisma.aBTest.updateMany({
    where: { shopId, testType, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  return prisma.aBTest.create({
    data: {
      shopId,
      name,
      testType,
      variantA,
      variantB,
      trafficSplit,
      isActive: true,
    },
  });
}

// ── Get active test for a given type ───────────────────

export async function getActiveTest(shopId: string, testType: string) {
  return prisma.aBTest.findFirst({
    where: { shopId, testType, isActive: true },
    orderBy: { startedAt: "desc" },
  });
}

// ── Randomly assign a variant ──────────────────────────

export function assignVariant(test: {
  id: string;
  trafficSplit: number;
  variantA: string;
  variantB: string;
}): { variant: "A" | "B"; config: unknown } {
  const rand = Math.random();
  // trafficSplit = fraction of traffic going to B
  if (rand < test.trafficSplit) {
    return {
      variant: "B",
      config: safeJsonParse(test.variantB),
    };
  }
  return {
    variant: "A",
    config: safeJsonParse(test.variantA),
  };
}

// ── Record impression ──────────────────────────────────

export async function recordImpression(testId: string, variant: "A" | "B") {
  if (variant === "A") {
    await prisma.aBTest.update({
      where: { id: testId },
      data: { impressionsA: { increment: 1 } },
    });
  } else {
    await prisma.aBTest.update({
      where: { id: testId },
      data: { impressionsB: { increment: 1 } },
    });
  }
}

// ── Record conversion ──────────────────────────────────

export async function recordConversion(
  testId: string,
  variant: "A" | "B",
  revenue?: number,
) {
  if (variant === "A") {
    await prisma.aBTest.update({
      where: { id: testId },
      data: {
        conversionsA: { increment: 1 },
        ...(revenue != null ? { revenueA: { increment: revenue } } : {}),
      },
    });
  } else {
    await prisma.aBTest.update({
      where: { id: testId },
      data: {
        conversionsB: { increment: 1 },
        ...(revenue != null ? { revenueB: { increment: revenue } } : {}),
      },
    });
  }
}

// ── Get test results with statistical significance ─────

export async function getTestResults(testId: string): Promise<TestResults | null> {
  const test = await prisma.aBTest.findUnique({ where: { id: testId } });
  if (!test) return null;

  const { impressionsA, impressionsB, conversionsA, conversionsB, revenueA, revenueB } = test;

  const conversionRateA = impressionsA > 0 ? conversionsA / impressionsA : 0;
  const conversionRateB = impressionsB > 0 ? conversionsB / impressionsB : 0;
  const revenuePerImpressionA = impressionsA > 0 ? revenueA / impressionsA : 0;
  const revenuePerImpressionB = impressionsB > 0 ? revenueB / impressionsB : 0;

  // Z-test for proportions
  const nA = impressionsA;
  const nB = impressionsB;
  const totalImpressions = nA + nB;
  const totalConversions = conversionsA + conversionsB;

  let zScore = 0;
  let isSignificant = false;

  if (totalImpressions > 0 && nA > 0 && nB > 0) {
    const p = totalConversions / totalImpressions;
    const pA = conversionRateA;
    const pB = conversionRateB;

    const standardError = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));

    if (standardError > 0) {
      zScore = (pA - pB) / standardError;
      isSignificant = Math.abs(zScore) > 1.96; // 95% confidence
    }
  }

  // Recommend winner only if significant
  let recommendedWinner: "A" | "B" | null = null;
  if (isSignificant) {
    recommendedWinner = conversionRateA > conversionRateB ? "A" : "B";
  }

  return {
    impressionsA,
    impressionsB,
    conversionsA,
    conversionsB,
    revenueA,
    revenueB,
    conversionRateA,
    conversionRateB,
    revenuePerImpressionA,
    revenuePerImpressionB,
    zScore,
    isSignificant,
    recommendedWinner,
  };
}

// ── End a test with a winner ───────────────────────────

export async function endTest(testId: string, winner: "A" | "B") {
  return prisma.aBTest.update({
    where: { id: testId },
    data: {
      isActive: false,
      endedAt: new Date(),
      winnerVariant: winner,
    },
  });
}

// ── Get all tests for a shop ───────────────────────────

export async function getShopTests(shopId: string) {
  return prisma.aBTest.findMany({
    where: { shopId },
    orderBy: { startedAt: "desc" },
  });
}

// ── Helpers ────────────────────────────────────────────

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
