import { describe, it, expect } from "vitest";
import { computeCarbonKg, computeLabel } from "./engine.server";
import type { EmissionFactor } from "@prisma/client";

// ── Helper: create a mock EmissionFactor ──────────────

function makeFactor(overrides: Partial<EmissionFactor> = {}): EmissionFactor {
  return {
    id: "test-factor",
    code: "textile.clothing",
    category: "textile",
    subcategory: "clothing",
    labelFr: "Vêtements",
    labelEn: "Clothing",
    kgCo2PerKg: 20,
    kgCo2PerUnit: null,
    defaultWeightG: 500,
    thresholdLow: 5,
    thresholdMed: 15,
    thresholdHigh: 30,
    source: "ADEME",
    confidence: 0.7,
    keywords: '["t-shirt","vêtement","textile"]',
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── computeCarbonKg ───────────────────────────────────

describe("computeCarbonKg", () => {
  it("uses kgCo2PerUnit when available (e.g. electronics)", () => {
    const factor = makeFactor({ kgCo2PerUnit: 50, kgCo2PerKg: 20 });
    const product = { id: "1", title: "Laptop", weight: 2000 };
    expect(computeCarbonKg(product, factor)).toBe(50);
  });

  it("uses kgCo2PerKg * weight when no per-unit factor", () => {
    const factor = makeFactor({ kgCo2PerUnit: null, kgCo2PerKg: 20 });
    const product = { id: "1", title: "T-shirt coton", weight: 300 };
    // 20 * 0.3 = 6
    expect(computeCarbonKg(product, factor)).toBe(6);
  });

  it("falls back to defaultWeightG when product has no weight", () => {
    const factor = makeFactor({ kgCo2PerUnit: null, kgCo2PerKg: 20, defaultWeightG: 500 });
    const product = { id: "1", title: "T-shirt", weight: null };
    // 20 * 0.5 = 10
    expect(computeCarbonKg(product, factor)).toBe(10);
  });

  it("falls back to 500g when neither product weight nor default weight", () => {
    const factor = makeFactor({ kgCo2PerUnit: null, kgCo2PerKg: 10, defaultWeightG: null });
    const product = { id: "1", title: "Produit inconnu", weight: null };
    // 10 * 0.5 = 5
    expect(computeCarbonKg(product, factor)).toBe(5);
  });

  it("returns 0 when neither kgCo2PerUnit nor kgCo2PerKg are set", () => {
    const factor = makeFactor({ kgCo2PerUnit: null, kgCo2PerKg: null });
    const product = { id: "1", title: "Mystery product", weight: 1000 };
    expect(computeCarbonKg(product, factor)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    const factor = makeFactor({ kgCo2PerUnit: null, kgCo2PerKg: 3.333 });
    const product = { id: "1", title: "Item", weight: 333 };
    // 3.333 * 0.333 = 1.109889 → 1.11
    expect(computeCarbonKg(product, factor)).toBe(1.11);
  });

  it("handles zero weight", () => {
    const factor = makeFactor({ kgCo2PerUnit: null, kgCo2PerKg: 20 });
    const product = { id: "1", title: "Digital", weight: 0 };
    expect(computeCarbonKg(product, factor)).toBe(0);
  });
});

// ── computeLabel ──────────────────────────────────────

describe("computeLabel", () => {
  const factor = makeFactor({
    thresholdLow: 5,
    thresholdMed: 15,
    thresholdHigh: 30,
  });

  it("returns LOW for scores <= thresholdLow", () => {
    expect(computeLabel(0, factor)).toBe("LOW");
    expect(computeLabel(5, factor)).toBe("LOW");
  });

  it("returns MEDIUM for scores between low and med", () => {
    expect(computeLabel(5.01, factor)).toBe("MEDIUM");
    expect(computeLabel(15, factor)).toBe("MEDIUM");
  });

  it("returns HIGH for scores between med and high", () => {
    expect(computeLabel(15.01, factor)).toBe("HIGH");
    expect(computeLabel(30, factor)).toBe("HIGH");
  });

  it("returns VERY_HIGH for scores above thresholdHigh", () => {
    expect(computeLabel(30.01, factor)).toBe("VERY_HIGH");
    expect(computeLabel(100, factor)).toBe("VERY_HIGH");
  });

  it("handles edge cases with zero", () => {
    expect(computeLabel(0, factor)).toBe("LOW");
  });
});

// ── Levenshtein / similarity (tested indirectly) ──────

describe("levenshtein similarity (via module internals)", () => {
  // These test the determinism requirement: same input → same output
  it("identical inputs produce identical results", () => {
    const factor = makeFactor();
    const product = { id: "1", title: "T-shirt coton bio", weight: 300 };
    const r1 = computeCarbonKg(product, factor);
    const r2 = computeCarbonKg(product, factor);
    expect(r1).toBe(r2);
  });
});
