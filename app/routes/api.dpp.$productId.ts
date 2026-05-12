import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getDPPData } from "../lib/dpp/generator.server";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export const headers = () => corsHeaders;

export async function loader({ params, request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Verify App Proxy signature — shop comes from authenticated session, never trust ?shop= from URL
  let shop: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return new Response(
        renderErrorPage("Accès non autorisé", "Cette page doit être accédée via la boutique du marchand."),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    shop = session.shop;
  } catch {
    return new Response(
      renderErrorPage("Accès non autorisé", "Cette page doit être accédée via la boutique du marchand."),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const productId = params.productId;

  if (!productId) {
    return new Response(
      renderErrorPage(
        "Paramètres manquants",
        "L'identifiant produit est requis.",
      ),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const dpp = await getDPPData(shop, productId);

  if (!dpp) {
    return new Response(
      renderErrorPage(
        "Produit introuvable",
        "Le passeport produit numérique demandé n'existe pas ou n'a pas encore été généré.",
      ),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  return new Response(renderDPPPage(dpp), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function getLabelColor(label: string): string {
  switch (label) {
    case "A":
      return "#16a34a";
    case "B":
      return "#65a30d";
    case "C":
      return "#ca8a04";
    case "D":
      return "#ea580c";
    case "E":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function getLabelBg(label: string): string {
  switch (label) {
    case "A":
      return "#dcfce7";
    case "B":
      return "#ecfccb";
    case "C":
      return "#fef9c3";
    case "D":
      return "#ffedd5";
    case "E":
      return "#fee2e2";
    default:
      return "#f3f4f6";
  }
}

interface DPPDisplayData {
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

function renderDPPPage(dpp: DPPDisplayData): string {
  const labelColor = getLabelColor(dpp.environmentalFootprint.carbonLabel);
  const labelBg = getLabelBg(dpp.environmentalFootprint.carbonLabel);
  const generatedDate = new Date(dpp.generatedAt).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const materialsHtml = dpp.materialsComposition.materials
    .map(
      (m) => `
      <div class="material-row">
        <div class="material-info">
          <span class="material-name">${escapeHtml(m.name)}${m.recycled ? ' <span class="recycled-badge">Recyclé</span>' : ""}</span>
        </div>
        <div class="material-bar-container">
          <div class="material-bar" style="width: ${m.percentage}%"></div>
        </div>
        <span class="material-pct">${m.percentage}%</span>
      </div>`,
    )
    .join("");

  const labelsHtml = ["A", "B", "C", "D", "E"]
    .map(
      (l) => `
      <div class="label-item ${l === dpp.environmentalFootprint.carbonLabel ? "active" : ""}"
           style="${l === dpp.environmentalFootprint.carbonLabel ? `background: ${getLabelColor(l)}; color: white;` : `background: ${getLabelBg(l)}; color: ${getLabelColor(l)};`}">
        ${l}
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DPP - ${escapeHtml(dpp.productIdentification.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%);
      min-height: 100vh;
      color: #1e293b;
      line-height: 1.6;
    }
    .container {
      max-width: 640px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      padding: 8px 16px;
      border-radius: 24px;
      font-size: 13px;
      color: #16a34a;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      margin-bottom: 16px;
    }
    .header-badge svg { width: 16px; height: 16px; }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #64748b;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    }
    .card-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-title svg { width: 18px; height: 18px; }
    .score-display {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 20px;
    }
    .score-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: ${labelBg};
      border: 4px solid ${labelColor};
      flex-shrink: 0;
    }
    .score-letter {
      font-size: 36px;
      font-weight: 800;
      color: ${labelColor};
      line-height: 1;
    }
    .score-value {
      font-size: 13px;
      color: ${labelColor};
      font-weight: 600;
    }
    .score-details { flex: 1; }
    .score-details .main-value {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
    }
    .score-details .main-unit {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
    }
    .score-details .method {
      font-size: 13px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .labels-scale {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }
    .label-item {
      flex: 1;
      text-align: center;
      padding: 6px 0;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      transition: transform 0.2s;
    }
    .label-item.active {
      transform: scale(1.15);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .material-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .material-info { width: 140px; flex-shrink: 0; }
    .material-name { font-size: 14px; font-weight: 500; }
    .recycled-badge {
      display: inline-block;
      font-size: 10px;
      background: #dcfce7;
      color: #16a34a;
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 600;
    }
    .material-bar-container {
      flex: 1;
      height: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }
    .material-bar {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #16a34a);
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    .material-pct {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      width: 40px;
      text-align: right;
    }
    .source-note {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 8px;
      font-style: italic;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .info-item {
      padding: 12px;
      background: #f8fafc;
      border-radius: 10px;
    }
    .info-item .label {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      margin-bottom: 4px;
    }
    .info-item .value {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .recyclability-card {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }
    .recycle-icon {
      width: 48px;
      height: 48px;
      background: #dcfce7;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .recycle-icon svg { width: 24px; height: 24px; color: #16a34a; }
    .recycle-info .recycle-score {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .recycle-info .recycle-instructions {
      font-size: 13px;
      color: #64748b;
    }
    .methodology-ref {
      font-size: 13px;
      color: #64748b;
    }
    .methodology-ref strong { color: #475569; }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 20px;
    }
    .footer-brand {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: #16a34a;
    }
    .footer-date {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 8px;
    }
    .footer-eu {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 4px;
    }
    @media (max-width: 480px) {
      .container { padding: 16px 12px; }
      .card { padding: 16px; }
      .score-display { gap: 16px; }
      .score-circle { width: 80px; height: 80px; }
      .score-letter { font-size: 28px; }
      .score-details .main-value { font-size: 22px; }
      .material-info { width: 100px; }
      .info-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-badge">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        Passeport Produit Digital
      </div>
      <h1>${escapeHtml(dpp.productIdentification.title)}</h1>
      <div class="subtitle">${escapeHtml(dpp.productIdentification.vendor)} &middot; ${escapeHtml(dpp.productIdentification.category)}</div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
        Empreinte environnementale
      </div>
      <div class="score-display">
        <div class="score-circle">
          <span class="score-letter">${dpp.environmentalFootprint.carbonLabel}</span>
          <span class="score-value">Score</span>
        </div>
        <div class="score-details">
          <div>
            <span class="main-value">${dpp.environmentalFootprint.carbonScoreKg.toFixed(2)}</span>
            <span class="main-unit">kg CO&#8322;e</span>
          </div>
          <div class="method">${escapeHtml(dpp.environmentalFootprint.methodology)}</div>
        </div>
      </div>
      <div class="labels-scale">
        ${labelsHtml}
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
        Composition des matériaux
      </div>
      ${materialsHtml}
      <div class="source-note">
        ${dpp.materialsComposition.source === "declared" ? "Composition déclarée par le fabricant" : "Composition estimée selon la catégorie produit"}
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        Informations produit
      </div>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Pays d'origine</div>
          <div class="value">${escapeHtml(dpp.origin.country)}</div>
        </div>
        <div class="info-item">
          <div class="label">Catégorie</div>
          <div class="value">${escapeHtml(dpp.productIdentification.category)}</div>
        </div>
        <div class="info-item">
          <div class="label">Fabricant</div>
          <div class="value">${escapeHtml(dpp.productIdentification.vendor)}</div>
        </div>
        <div class="info-item">
          <div class="label">Référence</div>
          <div class="value">${escapeHtml(dpp.productIdentification.shopifyProductId)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Recyclabilité
      </div>
      <div class="recyclability-card">
        <div class="recycle-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        </div>
        <div class="recycle-info">
          <div class="recycle-score">${escapeHtml(dpp.recyclability.score)}</div>
          <div class="recycle-instructions">${escapeHtml(dpp.recyclability.instructions)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/></svg>
        Méthodologie
      </div>
      <div class="methodology-ref">
        <p><strong>Standard :</strong> ${escapeHtml(dpp.methodology.standard)}</p>
        <p><strong>Base de données :</strong> ${escapeHtml(dpp.methodology.database)}</p>
        <p><strong>Version :</strong> ${escapeHtml(dpp.methodology.version)}</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-brand">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        Carboniq
      </div>
      <div class="footer-date">Généré le ${generatedDate}</div>
      <div class="footer-eu">Conforme au règlement EU Passeport Produit Numérique (ESPR 2024/1781)</div>
    </div>
  </div>
</body>
</html>`;
}

function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DPP - ${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f0f9ff 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1e293b;
    }
    .error-container {
      text-align: center;
      padding: 48px 24px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      max-width: 420px;
    }
    .error-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: #fef2f2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .error-icon svg { width: 32px; height: 32px; color: #ef4444; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; }
    .footer-brand {
      margin-top: 24px;
      font-size: 13px;
      color: #16a34a;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
    </div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="footer-brand">Carboniq</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
