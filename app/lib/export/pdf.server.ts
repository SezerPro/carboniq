import { jsPDF } from "jspdf";
import db from "../../db.server";
import { generateQRCodeDataUrl } from "./qrcode.server";

const BRAND_GREEN = "#4A7C59";
const TEXT_DARK = "#2C2825";
const TEXT_LIGHT = "#6b7280";

/**
 * Generate a branded PDF certificate for a given certificate ID.
 */
export async function generateCertificatePdf(
  certificateId: string,
): Promise<Buffer> {
  const certificate = await db.certificate.findUniqueOrThrow({
    where: { id: certificateId },
    include: {
      offset: {
        include: {
          shop: { select: { name: true, shopDomain: true } },
        },
      },
    },
  });

  const shop = certificate.offset.shop;
  const shopName = shop?.name ?? "Carboniq";
  const verifyUrl = `https://${shop?.shopDomain ?? "app.carboniq.dev"}/apps/carboniq/api/certificate/${certificate.uniqueCode}`;

  const dateStr = new Date(certificate.createdAt).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Generate QR code
  const qrDataUrl = await generateQRCodeDataUrl(verifyUrl);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Green header bar ──
  doc.setFillColor(74, 124, 89); // BRAND_GREEN
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.text("Carboniq", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(12);
  doc.text("Certificat de Compensation Carbone", pageWidth / 2, 30, {
    align: "center",
  });

  // ── Certificate code ──
  doc.setTextColor(TEXT_DARK);
  doc.setFontSize(10);
  doc.text(`Code : ${certificate.uniqueCode}`, pageWidth / 2, 52, {
    align: "center",
  });

  // ── Main value ──
  doc.setTextColor(BRAND_GREEN);
  doc.setFontSize(36);
  doc.text(
    `${certificate.carbonKg.toFixed(2)} kgCO₂e`,
    pageWidth / 2,
    75,
    { align: "center" },
  );

  doc.setTextColor(TEXT_LIGHT);
  doc.setFontSize(11);
  doc.text("compensés", pageWidth / 2, 83, { align: "center" });

  // ── Details grid ──
  const startY = 100;
  const leftCol = 30;
  const rightCol = pageWidth / 2 + 10;

  doc.setTextColor(TEXT_LIGHT);
  doc.setFontSize(9);

  const detailRows: Array<{ label: string; value: string; x: number }> = [
    { label: "Boutique", value: shopName, x: leftCol },
    { label: "Commande", value: certificate.orderName || "–", x: rightCol },
    { label: "Client", value: certificate.customerEmail || "–", x: leftCol },
    { label: "Date", value: dateStr, x: rightCol },
    {
      label: "Montant",
      value: `${certificate.offset.amountEur.toFixed(2)} EUR`,
      x: leftCol,
    },
    { label: "Statut", value: certificate.offset.status, x: rightCol },
  ];

  let y = startY;
  for (let i = 0; i < detailRows.length; i += 2) {
    const left = detailRows[i];
    const right = detailRows[i + 1];

    doc.setTextColor(TEXT_LIGHT);
    doc.setFontSize(8);
    doc.text(left.label.toUpperCase(), left.x, y);
    if (right) doc.text(right.label.toUpperCase(), right.x, y);

    doc.setTextColor(TEXT_DARK);
    doc.setFontSize(11);
    doc.text(left.value, left.x, y + 6);
    if (right) doc.text(right.value, right.x, y + 6);

    y += 16;
  }

  // ── Impact actions ──
  y += 5;
  const impacts: string[] = [];
  if (certificate.treesPlanted > 0)
    impacts.push(`Arbres plantes : ${certificate.treesPlanted}`);
  if (certificate.oceanKg > 0)
    impacts.push(`Plastique ocean : ${certificate.oceanKg} kg`);

  if (impacts.length > 0) {
    doc.setTextColor(TEXT_LIGHT);
    doc.setFontSize(8);
    doc.text("ACTIONS D'IMPACT", leftCol, y);
    y += 7;

    doc.setTextColor(BRAND_GREEN);
    doc.setFontSize(10);
    for (const impact of impacts) {
      doc.text(`• ${impact}`, leftCol, y);
      y += 6;
    }
  }

  // ── QR Code ──
  const qrSize = 30;
  const qrX = pageWidth / 2 - qrSize / 2;
  const qrY = y + 10;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // ── Footer ──
  const footerY = qrY + qrSize + 10;
  doc.setTextColor(TEXT_LIGHT);
  doc.setFontSize(8);
  doc.text(`Verifier : ${verifyUrl}`, pageWidth / 2, footerY, {
    align: "center",
  });
  doc.text(
    "Powered by Carboniq — Compensation carbone pour e-commerce",
    pageWidth / 2,
    footerY + 6,
    { align: "center" },
  );

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a multi-section RSE report PDF.
 */
export async function generateReportPdf(
  reportId: string,
): Promise<Buffer> {
  const report = await db.rSEReport.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      shop: { select: { name: true, shopDomain: true } },
    },
  });

  const shopName = report.shop?.name ?? "Carboniq";

  interface ReportData {
    totalProducts?: number;
    totalCarbonKg?: number;
    avgCarbonKg?: number;
    distribution?: Record<string, number>;
    topProducts?: Array<{ title: string; carbonScoreKg: number }>;
    totalOffsetKg?: number;
    totalTreesPlanted?: number;
    totalOceanKg?: number;
  }

  let data: ReportData = {};
  try {
    data = JSON.parse(report.dataJson) as ReportData;
  } catch {
    // fallback to empty
  }

  const periodLabel = report.period === "MONTHLY"
    ? "Mensuel"
    : report.period === "QUARTERLY"
      ? "Trimestriel"
      : "Annuel";

  const startStr = new Date(report.periodStart).toLocaleDateString("fr-FR");
  const endStr = new Date(report.periodEnd).toLocaleDateString("fr-FR");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Green header bar ──
  doc.setFillColor(74, 124, 89);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(`Rapport RSE ${periodLabel}`, pageWidth / 2, 18, {
    align: "center",
  });
  doc.setFontSize(11);
  doc.text(`${shopName} — ${startStr} au ${endStr}`, pageWidth / 2, 30, {
    align: "center",
  });

  let y = 55;
  const leftCol = 20;

  // ── Section 1: Summary ──
  doc.setTextColor(BRAND_GREEN);
  doc.setFontSize(14);
  doc.text("Resume", leftCol, y);
  y += 8;

  doc.setTextColor(TEXT_DARK);
  doc.setFontSize(10);

  const summaryLines = [
    `Produits analyses : ${data.totalProducts ?? 0}`,
    `Empreinte totale : ${(data.totalCarbonKg ?? 0).toFixed(2)} kgCO₂e`,
    `Moyenne par produit : ${(data.avgCarbonKg ?? 0).toFixed(2)} kgCO₂e`,
    `Total compense : ${(data.totalOffsetKg ?? 0).toFixed(2)} kgCO₂e`,
    `Arbres plantes : ${data.totalTreesPlanted ?? 0}`,
    `Plastique ocean retire : ${(data.totalOceanKg ?? 0).toFixed(2)} kg`,
  ];

  for (const line of summaryLines) {
    doc.text(line, leftCol + 5, y);
    y += 6;
  }

  // ── Section 2: Distribution ──
  y += 8;
  doc.setTextColor(BRAND_GREEN);
  doc.setFontSize(14);
  doc.text("Repartition par impact", leftCol, y);
  y += 8;

  doc.setTextColor(TEXT_DARK);
  doc.setFontSize(10);

  const dist = data.distribution ?? {};
  const distLabels: Record<string, string> = {
    LOW: "Faible (A)",
    MEDIUM: "Moyen (B)",
    HIGH: "Eleve (C)",
    VERY_HIGH: "Tres eleve (D)",
  };

  for (const [key, label] of Object.entries(distLabels)) {
    const count = dist[key] ?? 0;
    doc.text(`${label} : ${count} produit${count > 1 ? "s" : ""}`, leftCol + 5, y);
    y += 6;
  }

  // ── Section 3: Top impact products ──
  const topProducts = data.topProducts ?? [];
  if (topProducts.length > 0) {
    y += 8;
    doc.setTextColor(BRAND_GREEN);
    doc.setFontSize(14);
    doc.text("Produits a plus fort impact", leftCol, y);
    y += 8;

    doc.setTextColor(TEXT_DARK);
    doc.setFontSize(10);

    for (const product of topProducts.slice(0, 10)) {
      const line = `${product.title} — ${product.carbonScoreKg.toFixed(2)} kgCO₂e`;
      doc.text(line, leftCol + 5, y);
      y += 6;

      // Page break if needed
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setTextColor(TEXT_LIGHT);
  doc.setFontSize(8);
  doc.text(
    `Genere le ${new Date().toLocaleDateString("fr-FR")} — Powered by Carboniq`,
    pageWidth / 2,
    footerY,
    { align: "center" },
  );

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
