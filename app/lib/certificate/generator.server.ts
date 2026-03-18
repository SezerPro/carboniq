import prisma from "../../db.server";

const ALPHANUMERIC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a unique certificate code in the format CIQ-XXXX-XXXX.
 * Uses alphanumeric characters excluding ambiguous ones (0, O, 1, I).
 */
function generateCertCode(): string {
  let segment1 = "";
  let segment2 = "";

  for (let i = 0; i < 4; i++) {
    segment1 += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
    segment2 += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }

  return `CIQ-${segment1}-${segment2}`;
}

/**
 * Create a certificate for a completed carbon offset.
 * Generates a unique code and persists the Certificate record.
 */
export async function createCertificate(offsetId: string) {
  const offset = await prisma.carbonOffset.findUniqueOrThrow({
    where: { id: offsetId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          domain: true,
          logoUrl: true,
        },
      },
      impactActions: true,
    },
  });

  // Ensure uniqueness of the code
  let code = generateCertCode();
  let existing = await prisma.certificate.findUnique({ where: { code } });
  while (existing) {
    code = generateCertCode();
    existing = await prisma.certificate.findUnique({ where: { code } });
  }

  const certificate = await prisma.certificate.create({
    data: {
      code,
      offsetId: offset.id,
      shopId: offset.shopId,
      customerEmail: offset.customerEmail,
      orderName: offset.orderName,
      carbonKg: offset.carbonKg,
      amountEur: offset.amountEur,
    },
  });

  return {
    ...certificate,
    offset,
  };
}

/**
 * Look up a certificate by its unique public code.
 * Used on the public verification page.
 */
export async function getCertificateByCode(code: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { code },
    include: {
      offset: {
        include: {
          shop: {
            select: {
              name: true,
              domain: true,
              logoUrl: true,
            },
          },
          impactActions: true,
        },
      },
    },
  });

  return certificate;
}

/**
 * Generate a full HTML document for the certificate, suitable for
 * rendering as a page or converting to PDF.
 */
export async function generateCertificateHTML(certificateId: string) {
  const certificate = await prisma.certificate.findUniqueOrThrow({
    where: { id: certificateId },
    include: {
      offset: {
        include: {
          shop: {
            select: {
              name: true,
              domain: true,
              logoUrl: true,
            },
          },
          impactActions: true,
        },
      },
    },
  });

  const shop = certificate.offset.shop;
  const offset = certificate.offset;
  const actions = offset.impactActions ?? [];
  const treesAction = actions.find((a) => a.type === "TREE");
  const oceanAction = actions.find((a) => a.type === "OCEAN");
  const dateStr = new Date(certificate.createdAt).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const verifyUrl = `https://${shop.domain ?? "app.carboniq.dev"}/api/certificate/${certificate.code}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Carbon Offset Certificate - ${certificate.code}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #f0fdf4;
      color: #1a1a1a;
      display: flex;
      justify-content: center;
      padding: 2rem;
    }
    .certificate {
      max-width: 720px;
      width: 100%;
      background: #fff;
      border: 3px solid #16a34a;
      border-radius: 16px;
      padding: 3rem;
      position: relative;
      overflow: hidden;
    }
    .certificate::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 8px;
      background: linear-gradient(90deg, #16a34a, #22d3ee, #16a34a);
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .header .logo {
      max-height: 48px;
      margin-bottom: 0.5rem;
    }
    .header h1 {
      font-size: 1.75rem;
      color: #16a34a;
      font-weight: 700;
    }
    .header .subtitle {
      font-size: 0.95rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }
    .section {
      margin: 1.5rem 0;
    }
    .section-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }
    .big-number {
      font-size: 2.5rem;
      font-weight: 800;
      color: #16a34a;
      text-align: center;
    }
    .big-number span {
      font-size: 1rem;
      font-weight: 400;
      color: #6b7280;
    }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .detail-item {
      background: #f9fafb;
      padding: 1rem;
      border-radius: 8px;
    }
    .detail-item .label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #9ca3af;
      margin-bottom: 0.25rem;
    }
    .detail-item .value {
      font-size: 1rem;
      font-weight: 600;
      color: #1a1a1a;
    }
    .impact-badges {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #ecfdf5;
      border: 1px solid #bbf7d0;
      border-radius: 999px;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      font-weight: 500;
      color: #16a34a;
    }
    .footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: #9ca3af;
    }
    .footer .code {
      font-family: monospace;
      font-size: 1rem;
      font-weight: 700;
      color: #16a34a;
      margin-bottom: 0.25rem;
    }
    .qr-placeholder {
      width: 100px;
      height: 100px;
      margin: 1rem auto;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      ${shop.logoUrl ? `<img class="logo" src="${shop.logoUrl}" alt="${shop.name}" />` : ""}
      <h1>Carbon Offset Certificate</h1>
      <div class="subtitle">Issued by ${shop.name ?? "Carboniq"} via Carboniq</div>
    </div>

    <div class="section" style="text-align:center;">
      <div class="section-title">Total Carbon Offset</div>
      <div class="big-number">${certificate.carbonKg.toFixed(2)} <span>kg CO₂</span></div>
    </div>

    <div class="section">
      <div class="details">
        <div class="detail-item">
          <div class="label">Customer</div>
          <div class="value">${certificate.customerEmail ?? "N/A"}</div>
        </div>
        <div class="detail-item">
          <div class="label">Order</div>
          <div class="value">${certificate.orderName ?? "N/A"}</div>
        </div>
        <div class="detail-item">
          <div class="label">Amount</div>
          <div class="value">${certificate.amountEur.toFixed(2)} EUR</div>
        </div>
        <div class="detail-item">
          <div class="label">Date</div>
          <div class="value">${dateStr}</div>
        </div>
      </div>
    </div>

    ${
      treesAction || oceanAction
        ? `<div class="section">
      <div class="section-title" style="text-align:center;">Impact Actions</div>
      <div class="impact-badges">
        ${treesAction ? '<div class="badge">&#127794; Tree Planting</div>' : ""}
        ${oceanAction ? '<div class="badge">&#127754; Ocean Plastic Removal</div>' : ""}
      </div>
    </div>`
        : ""
    }

    <div class="footer">
      <div class="qr-placeholder">QR: ${verifyUrl}</div>
      <div class="code">${certificate.code}</div>
      <div>Verify at ${verifyUrl}</div>
      <div style="margin-top:0.75rem;">Powered by Carboniq &mdash; Carbon offsetting for e-commerce</div>
    </div>
  </div>
</body>
</html>`;
}
