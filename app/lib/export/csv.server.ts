import db from "../../db.server";

/**
 * Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines.
 */
function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function gradeFromLabel(label: string | null): string {
  switch (label) {
    case "LOW":
      return "A";
    case "MEDIUM":
      return "B";
    case "HIGH":
      return "C";
    case "VERY_HIGH":
      return "D";
    default:
      return "–";
  }
}

/**
 * Export all products for a shop as a CSV string (UTF-8 BOM for Excel FR).
 */
export async function exportProductsCsv(shopId: string): Promise<string> {
  const products = await db.product.findMany({
    where: { shopId },
    orderBy: { title: "asc" },
  });

  const header = [
    "Produit",
    "Type",
    "Score (kgCO₂e)",
    "Impact",
    "Grade",
    "Confiance (%)",
    "Catégorie",
    "Analysé le",
  ];

  const rows = products.map((p) => [
    escapeCsv(p.title),
    escapeCsv(p.productType ?? ""),
    p.carbonScoreKg != null ? p.carbonScoreKg.toFixed(3) : "",
    escapeCsv(p.carbonLabel ?? ""),
    gradeFromLabel(p.carbonLabel),
    p.confidence != null ? (p.confidence * 100).toFixed(0) : "",
    escapeCsv(p.categoryCode ?? ""),
    formatDate(p.calculatedAt),
  ]);

  const lines = [header.join(","), ...rows.map((r) => r.join(","))];

  // BOM prefix for Excel French compatibility
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/**
 * Export all offsets + certificates for a shop as a CSV string.
 */
export async function exportOffsetsCsv(shopId: string): Promise<string> {
  const offsets = await db.carbonOffset.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    include: { certificate: true },
  });

  const header = [
    "Commande",
    "Client",
    "Email",
    "CO₂ compensé (kg)",
    "Montant (EUR)",
    "Statut",
    "Certificat",
    "Date",
  ];

  const rows = offsets.map((o) => [
    escapeCsv(o.orderName ?? o.orderId),
    escapeCsv(o.customerEmail?.split("@")[0] ?? ""),
    escapeCsv(o.customerEmail ?? ""),
    o.carbonKg.toFixed(3),
    o.amountEur.toFixed(2),
    escapeCsv(o.status),
    escapeCsv(o.certificate?.uniqueCode ?? ""),
    formatDate(o.createdAt),
  ]);

  const lines = [header.join(","), ...rows.map((r) => r.join(","))];

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
