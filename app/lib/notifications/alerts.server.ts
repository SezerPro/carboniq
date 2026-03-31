import type { PlanTier } from "../plans/constants";
import { PRODUCT_LIMITS } from "../plans/gates.server";
import db from "../../db.server";

// ── Alert types ──

export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  action?: { label: string; url: string };
  dismissKey: string; // localStorage key for dismissal
}

// ── Compute alerts for dashboard ──

export async function computeAlerts(
  shop: { id: string; plan: string; planStatus: string; trialEndsAt: Date | null },
  stats: { total: number },
  planTier: PlanTier,
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  // 1. Trial ending soon (< 3 days)
  if (shop.planStatus === "TRIALING" && shop.trialEndsAt) {
    const daysLeft = Math.ceil((shop.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3 && daysLeft > 0) {
      alerts.push({
        id: "trial-ending",
        severity: "critical",
        title: `Essai gratuit : ${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`,
        message: "Votre période d'essai se termine bientôt. Choisissez un plan pour continuer à utiliser toutes les fonctionnalités.",
        action: { label: "Voir les plans", url: "/app/pricing" },
        dismissKey: `alert:trial:${shop.trialEndsAt.toISOString().slice(0, 10)}`,
      });
    } else if (daysLeft <= 0) {
      alerts.push({
        id: "trial-expired",
        severity: "critical",
        title: "Essai gratuit terminé",
        message: "Votre période d'essai est terminée. Passez à un plan payant pour retrouver l'accès à toutes les fonctionnalités.",
        action: { label: "Choisir un plan", url: "/app/pricing" },
        dismissKey: "alert:trial-expired",
      });
    }
  }

  // 2. Quota produits approche la limite
  const limit = PRODUCT_LIMITS[planTier];
  if (limit < 999999) {
    const pct = Math.round((stats.total / limit) * 100);
    if (pct >= 95) {
      alerts.push({
        id: "quota-critical",
        severity: "critical",
        title: `Quota produits : ${stats.total} / ${limit} (${pct}%)`,
        message: "Vous avez presque atteint la limite de votre plan. Les nouveaux produits ne seront plus analysés.",
        action: { label: "Upgrader", url: "/app/pricing" },
        dismissKey: `alert:quota:95:${now.toISOString().slice(0, 7)}`,
      });
    } else if (pct >= 80) {
      alerts.push({
        id: "quota-warning",
        severity: "warning",
        title: `Quota produits : ${stats.total} / ${limit} (${pct}%)`,
        message: "Vous approchez de la limite de votre plan. Pensez à upgrader pour analyser plus de produits.",
        action: { label: "Voir les plans", url: "/app/pricing" },
        dismissKey: `alert:quota:80:${now.toISOString().slice(0, 7)}`,
      });
    }
  }

  // 3. Compliance issues critiques (dernier scan)
  try {
    const lastScan = await db.complianceScan.findFirst({
      where: { shopId: shop.id },
      orderBy: { scannedAt: "desc" },
    });
    if (lastScan && lastScan.totalIssues > 0) {
      const findings = JSON.parse(lastScan.findings || "[]") as Array<{ severity: string }>;
      const criticalCount = findings.filter((f) => f.severity === "critical" || f.severity === "high").length;
      if (criticalCount > 0) {
        alerts.push({
          id: "compliance-issues",
          severity: "warning",
          title: `${criticalCount} problème${criticalCount > 1 ? "s" : ""} de conformité EU détecté${criticalCount > 1 ? "s" : ""}`,
          message: "Des claims non conformes ont été détectés dans vos fiches produit. Corrigez-les pour éviter des sanctions.",
          action: { label: "Voir le scan", url: "/app/compliance" },
          dismissKey: `alert:compliance:${lastScan.id}`,
        });
      }
    }
  } catch {
    // Compliance scan table may not exist yet — ignore
  }

  // 4. Produits non scorés
  try {
    const unscoredCount = await db.product.count({
      where: { shopId: shop.id, carbonScoreKg: null },
    });
    if (unscoredCount > 0) {
      alerts.push({
        id: "unscored-products",
        severity: "info",
        title: `${unscoredCount} produit${unscoredCount > 1 ? "s" : ""} sans score CO₂`,
        message: "Certains produits n'ont pas encore été analysés. Lancez un recalcul pour les scorer.",
        dismissKey: `alert:unscored:${now.toISOString().slice(0, 7)}`,
      });
    }
  } catch {
    // Ignore
  }

  // Sort by severity priority and limit to 3
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return alerts.slice(0, 3);
}
