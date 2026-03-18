import { useEffect, useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { calculateAndSave } from "../lib/carbon/engine.server";
import { seedEmissionFactors } from "../lib/carbon/seed.server";
import { T, IMPACT, S } from "../lib/design/tokens";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
    include: { subscription: true },
  });

  // Auto-create shop if first visit
  if (!shop) {
    const newShop = await db.shop.create({
      data: {
        shopDomain: session.shop,
        accessToken: session.accessToken ?? "",
        plan: "STARTER",
        planStatus: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Seed emission factors on first install
    await seedEmissionFactors();

    return {
      shop: newShop,
      stats: { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0, total: 0 },
      products: [],
      subscription: null,
    };
  }

  // Aggregate stats by label
  const products = await db.product.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const stats = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0, total: products.length };
  for (const p of products) {
    if (p.carbonLabel) stats[p.carbonLabel]++;
  }

  return {
    shop,
    stats,
    products: products.map((p) => ({
      id: p.id,
      shopifyProductId: p.shopifyProductId,
      title: p.title,
      carbonScoreKg: p.carbonScoreKg,
      carbonLabel: p.carbonLabel,
      confidence: p.confidence,
      calculatedAt: p.calculatedAt?.toISOString() ?? null,
    })),
    subscription: shop.subscription,
  };
};

// ── Action ─────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "recalculate") {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });

    if (!shop) return { error: "Shop not found" };

    // Seed factors in case they're missing
    await seedEmissionFactors();

    // Fetch all products from Shopify
    let hasNextPage = true;
    let cursor: string | null = null;
    let processed = 0;

    while (hasNextPage) {
      const response = await admin.graphql(
        `#graphql
        query getProducts($cursor: String) {
          products(first: 50, after: $cursor) {
            edges {
              node {
                id
                title
                productType
                tags
                vendor
                variants(first: 1) {
                  edges {
                    node {
                      inventoryItem {
                        measurement {
                          weight {
                            value
                            unit
                          }
                        }
                      }
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }`,
        { variables: { cursor } },
      );

      const json = await response.json();
      const edges = json.data?.products?.edges ?? [];
      hasNextPage = json.data?.products?.pageInfo?.hasNextPage ?? false;

      for (const edge of edges) {
        const node = edge.node;
        cursor = edge.cursor;

        // Convert weight to grams
        const measurement = node.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight;
        let weightGrams: number | null = null;
        if (measurement?.value) {
          const w = Number(measurement.value);
          switch (measurement.unit) {
            case "KILOGRAMS": weightGrams = w * 1000; break;
            case "GRAMS": weightGrams = w; break;
            case "POUNDS": weightGrams = w * 453.592; break;
            case "OUNCES": weightGrams = w * 28.3495; break;
            default: weightGrams = w * 1000;
          }
        }

        // Extract numeric ID from gid
        const gid = node.id; // gid://shopify/Product/12345
        const numericId = gid.split("/").pop() ?? gid;

        await calculateAndSave(shop.id, {
          id: numericId,
          title: node.title,
          product_type: node.productType || null,
          tags: (node.tags ?? []).join(", ") || null,
          vendor: node.vendor || null,
          weight: weightGrams,
        });
        processed++;
      }
    }

    return { success: true, processed };
  }

  return { error: "Unknown intent" };
};

// ── Component ──────────────────────────────────────────

const CSS = `
.cq *{box-sizing:border-box;margin:0;padding:0}
.cq{font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#f0ece6}
.cq-bento{display:grid;grid-template-columns:repeat(12,1fr);gap:14px;margin-bottom:16px}
.cq-bento-5{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:16px}
.cq-s5{grid-column:span 5}.cq-s7{grid-column:span 7}
.cq-card{background:#fdfcfb;border-radius:18px;border:1px solid rgba(164,156,144,.18);box-shadow:0 2px 8px rgba(26,22,18,.05);position:relative;overflow:hidden;transition:all .2s ease;opacity:0;will-change:transform,opacity;animation:cqUp .5s cubic-bezier(0,0,.2,1) forwards}
.cq-card:hover{box-shadow:0 6px 20px rgba(26,22,18,.09);transform:translateY(-2px)}
.cq-accent{position:absolute;top:0;left:0;right:0;height:3px;border-radius:18px 18px 0 0}
.cq-lbl{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#a09890}
.cq-num{font-family:'Instrument Serif',Georgia,'Times New Roman',serif!important;font-size:58px!important;line-height:1!important;letter-spacing:-.04em!important;color:#1a1612;margin-top:10px;font-variant-numeric:tabular-nums}
.cq-sub{font-size:12px;color:#a09890;margin-top:6px}
.cq-badge{position:absolute;top:18px;right:18px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px}
.cq-hero{background:radial-gradient(ellipse at 20% 50%,#1a3a0f 0%,#1a1612 40%,#0d1a08 100%);border:1px solid rgba(74,138,50,.2)!important;box-shadow:0 0 60px rgba(74,138,50,.08) inset,0 8px 32px rgba(0,0,0,.2);padding:32px;position:relative;overflow:hidden}
.cq-hero::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:radial-gradient(circle,rgba(74,138,50,.25) 0%,transparent 70%);border-radius:50%;animation:cqGlow 4s ease-in-out infinite}
.cq-hero .cq-lbl{color:rgba(253,252,251,.45)}
.cq-hero .cq-num{font-family:'Instrument Serif',Georgia,'Times New Roman',serif!important;font-size:92px!important;line-height:1!important;letter-spacing:-.05em!important;color:#fdfcfb}
.cq-hero .cq-unit{font-family:'DM Mono',monospace;font-size:15px;color:rgba(253,252,251,.4);letter-spacing:-.02em}
.cq-hero .cq-sub{color:rgba(253,252,251,.35)}
.cq-mods{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px}
.cq-mod{background:#fdfcfb;border-radius:14px;padding:14px;border:1px solid rgba(164,156,144,.18);cursor:pointer;transition:all .2s ease;text-decoration:none;display:flex;flex-direction:column;gap:6px;opacity:0;will-change:transform,opacity;animation:cqUp .5s cubic-bezier(0,0,.2,1) forwards;color:inherit}
.cq-mod:hover{background:#f7f5f3;border-color:rgba(74,138,50,.25)!important;transform:translateY(-3px);box-shadow:0 8px 24px rgba(26,22,18,.1),0 0 0 1px rgba(74,138,50,.1)!important}
.cq-mod-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cq-mod-icon svg{width:16px;height:16px}
.cq-mod-t{font-size:12.5px;font-weight:500;color:#1a1612}
.cq-mod-d{font-size:11px;color:#a09890}
.cq-tw{background:#fdfcfb;border-radius:18px;border:1px solid rgba(164,156,144,.18);overflow:hidden;box-shadow:0 2px 8px rgba(26,22,18,.05);opacity:0;will-change:transform,opacity;animation:cqUp .5s cubic-bezier(0,0,.2,1) .25s forwards}
.cq-tw-h{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid rgba(164,156,144,.12)}
.cq-tw-t{font-size:14px;font-weight:600;color:#1a1612}
.cq-tw-c{font-size:12px;color:#a09890;font-family:'DM Mono',monospace}
.cq-tbl{width:100%;border-collapse:collapse}
.cq-tbl thead th{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#a09890;padding:10px 24px;text-align:left;background:#f7f5f3;border-bottom:1px solid rgba(164,156,144,.12)}
.cq-tbl tbody tr{transition:background .12s ease;cursor:pointer;position:relative}
.cq-tbl tbody tr:hover{background:#f7f5f3}
.cq-tbl tbody tr::after{content:'→';position:absolute;right:24px;top:50%;transform:translateY(-50%) translateX(4px);opacity:0;color:#a09890;font-size:14px;transition:all .15s ease}
.cq-tbl tbody tr:hover::after{opacity:1;transform:translateY(-50%) translateX(0)}
.cq-tbl tbody td{padding:13px 24px;font-size:13.5px;color:#2a2520;border-bottom:1px solid rgba(164,156,144,.08)}
.cq-tbl tbody tr:last-child td{border-bottom:none}
.cq-co2{font-family:'DM Mono',monospace;font-size:13px;font-weight:500;letter-spacing:-.02em}
.cq-co2 span{font-size:10px;color:#a09890;margin-left:2px}
.cq-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:500}
.cq-pill-low{background:#dcfce7;color:#15803d}.cq-pill-med{background:#fef9c3;color:#a16207}
.cq-pill-high{background:#ffedd5;color:#c2410c}.cq-pill-vh{background:#fee2e2;color:#b91c1c}
.cq-conf{display:flex;align-items:center;gap:8px}
.cq-conf-t{width:56px;height:4px;background:#ede9e4;border-radius:999px;overflow:hidden;flex-shrink:0}
.cq-conf-f{height:100%;border-radius:999px;transition:width .5s ease}
.cq-conf-p{font-family:'DM Mono',monospace;font-size:11px;color:#a09890}
.cq-q{padding:24px 28px}.cq-q-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.cq-q-t{font-size:13px;font-weight:500;color:#5e574f}
.cq-q-n{font-family:'DM Mono',monospace;font-size:13px;font-weight:500;color:#1a1612}
.cq-q-track{height:7px;background:#ede9e4;border-radius:999px;overflow:hidden;margin-bottom:10px}
.cq-q-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#4a8a32,#7ab856);transition:width 1s cubic-bezier(.4,0,.2,1)}
.cq-q-info{display:flex;justify-content:space-between;font-size:12px;color:#a09890}
.cq-q-plan{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;padding:2px 8px;background:#f0fdf4;color:#15803d;border-radius:999px;border:1px solid #bbf7d0}
.cq-sep{display:flex;align-items:center;gap:12px;margin:24px 0 12px}
.cq-sep-t{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#a09890;white-space:nowrap}
.cq-sep-l{flex:1;height:1px;background:linear-gradient(90deg,rgba(164,156,144,.3),transparent)}
@keyframes cqUp{from{opacity:0;transform:translateY(20px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes cqGlow{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
.cq-bento-5 .cq-card:nth-child(1){animation-delay:.05s}.cq-bento-5 .cq-card:nth-child(2){animation-delay:.1s}
.cq-bento-5 .cq-card:nth-child(3){animation-delay:.15s}.cq-bento-5 .cq-card:nth-child(4){animation-delay:.2s}
.cq-bento-5 .cq-card:nth-child(5){animation-delay:.25s}
.cq-mods .cq-mod:nth-child(1){animation-delay:.06s}.cq-mods .cq-mod:nth-child(2){animation-delay:.1s}
.cq-mods .cq-mod:nth-child(3){animation-delay:.14s}.cq-mods .cq-mod:nth-child(4){animation-delay:.18s}
.cq-mods .cq-mod:nth-child(5){animation-delay:.22s}.cq-mods .cq-mod:nth-child(6){animation-delay:.26s}
.cq-mods .cq-mod:nth-child(7){animation-delay:.3s}.cq-mods .cq-mod:nth-child(8){animation-delay:.34s}
.cq-mods .cq-mod:nth-child(9){animation-delay:.38s}.cq-mods .cq-mod:nth-child(10){animation-delay:.42s}
.cq-mods .cq-mod:nth-child(11){animation-delay:.46s}
@media(max-width:1024px){.cq-mods{grid-template-columns:repeat(4,1fr)}.cq-bento-5{grid-template-columns:repeat(3,1fr)}.cq-s5{grid-column:span 6}.cq-s7{grid-column:span 6}}
@media(max-width:768px){.cq-bento{grid-template-columns:1fr 1fr;gap:10px}.cq-bento-5{grid-template-columns:repeat(2,1fr)}.cq-s5,.cq-s7{grid-column:span 2}.cq-mods{grid-template-columns:repeat(3,1fr)}.cq-hero .cq-num{font-size:52px!important}}
`;

const MODULES = [
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>', color: "#4a8a32", bg: "#f0fdf4", t: "Analytiques", d: "Tendances", r: "/app/analytics" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 9-8 9z"/></svg>', color: "#4a8a32", bg: "#f0fdf4", t: "Réduire", d: "Conseils IA", r: "/app/reduction" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>', color: "#3b82f6", bg: "#eff6ff", t: "DPP", d: "Passeport EU", r: "/app/dpp" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>', color: "#7c3aed", bg: "#faf5ff", t: "Rapports", d: "RSE / CSRD", r: "/app/reports" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', color: "#059669", bg: "#ecfdf5", t: "Conformité", d: "Green Claims", r: "/app/compliance" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>', color: "#d97706", bg: "#fffbeb", t: "A/B Test", d: "Optimiser", r: "/app/abtest" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>', color: "#b45309", bg: "#fef9c3", t: "ROI", d: "Performance", r: "/app/roi" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>', color: "#0369a1", bg: "#f0f9ff", t: "Benchmark", d: "Secteur", r: "/app/benchmark" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>', color: "#6d28d9", bg: "#fdf4ff", t: "Scope 3", d: "Supply chain", r: "/app/scope3" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>', color: "#0d9488", bg: "#f0fdfa", t: "Impact", d: "Portail public", r: "/app/impact" },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>', color: "#64748b", bg: "#f8fafc", t: "Paramètres", d: "Config", r: "/app/settings" },
];

const PILLS: Record<string, { cls: string; icon: string; text: string }> = {
  LOW: { cls: "cq-pill-low", icon: "🌿", text: "Faible" },
  MEDIUM: { cls: "cq-pill-med", icon: "🍃", text: "Modéré" },
  HIGH: { cls: "cq-pill-high", icon: "⚠️", text: "Élevé" },
  VERY_HIGH: { cls: "cq-pill-vh", icon: "🔴", text: "Très élevé" },
};

const LABEL_COLORS: Record<string, { color: string; bg: string; accent: string }> = {
  LOW: { color: "#15803d", bg: "#dcfce7", accent: "linear-gradient(90deg,#4a8a32,#7ab856)" },
  MEDIUM: { color: "#a16207", bg: "#fef9c3", accent: "linear-gradient(90deg,#d97706,#f59e0b)" },
  HIGH: { color: "#c2410c", bg: "#ffedd5", accent: "linear-gradient(90deg,#c2410c,#ea580c)" },
  VERY_HIGH: { color: "#b91c1c", bg: "#fee2e2", accent: "linear-gradient(90deg,#b91c1c,#ef4444)" },
};

export default function Index() {
  const { stats, products, subscription } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isRecalculating =
    fetcher.state !== "idle" && fetcher.formData?.get("intent") === "recalculate";

  useEffect(() => {
    if (fetcher.data && "processed" in fetcher.data) {
      shopify.toast.show(`${fetcher.data.processed} produits recalculés`);
    }
  }, [fetcher.data, shopify]);

  // Global overrides + fonts + animations
  useEffect(() => {
    // FIX 1 — Force background through Polaris
    const style = document.createElement("style");
    style.id = "cq-global-override";
    style.textContent = `
      html,body,#app,[data-shopify-app-init]{background:#f0ece6!important}
      .Polaris-Frame__Main{background:#f0ece6!important}
      .Polaris-Frame{background:#f0ece6!important}
    `;
    document.head.appendChild(style);

    // FIX 2 — Inject font via JS (Polaris blocks @import)
    if (!document.getElementById("cq-fonts")) {
      const link = document.createElement("link");
      link.id = "cq-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap";
      document.head.appendChild(link);
    }

    // Animate number counters
    const nums = document.querySelectorAll(".cq-num");
    nums.forEach((el) => {
      const target = parseFloat(el.textContent || "0");
      if (isNaN(target)) return;
      let start = 0;
      const duration = 800;
      const isInt = target % 1 === 0;
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = isInt ? Math.round(eased * target).toString() : (eased * target).toFixed(1);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    return () => { document.getElementById("cq-global-override")?.remove(); };
  }, []);

  const navigate = useNavigate();

  const handleRecalculate = useCallback(() => {
    fetcher.submit({ intent: "recalculate" }, { method: "POST" });
  }, [fetcher]);

  const productLimit = subscription?.productLimit ?? 50;
  const productsUsed = subscription?.productsUsed ?? stats.total;
  const quotaPct = Math.min(100, Math.round((productsUsed / productLimit) * 100));

  const scoredProducts = products.filter((p) => p.carbonScoreKg != null);
  const avgCo2 = scoredProducts.length > 0
    ? scoredProducts.reduce((sum, p) => sum + (p.carbonScoreKg ?? 0), 0) / scoredProducts.length
    : 0;
  const avgStr = avgCo2 < 1 ? avgCo2.toFixed(2) : avgCo2.toFixed(1);

  return (
    <s-page heading="Carboniq">
      <s-button
        slot="primary-action"
        onClick={handleRecalculate}
        {...(isRecalculating ? { loading: true } : {})}
      >
        Recalculer tout
      </s-button>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="cq">

        {/* ── ROW 1 — Stats (5 colonnes) ── */}
        <div className="cq-bento-5">
          <div className="cq-card" style={{ padding: 24 }}>
            <div className="cq-accent" style={{ background: "linear-gradient(90deg,#334155,#64748b)" }} />
            <div className="cq-lbl">Produits analysés</div>
            <div className="cq-num">{stats.total}</div>
            <div className="cq-sub">sur {productLimit} disponibles</div>
          </div>

          {(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const).map((key) => {
            const lc = LABEL_COLORS[key];
            const pill = PILLS[key];
            const count = stats[key];
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div className="cq-card" key={key} style={{ padding: 24 }}>
                <div className="cq-accent" style={{ background: lc.accent }} />
                <div className="cq-lbl" style={{ color: lc.color }}>{pill.icon} {pill.text}</div>
                <div className="cq-num" style={{ color: lc.color, fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 58, letterSpacing: "-0.04em", lineHeight: 1 }}>{count}</div>
                {stats.total > 0 && (
                  <div className="cq-badge" style={{ color: lc.color, background: lc.bg }}>{pct}%</div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── ROW 2 — Hero score + Quota ── */}
        <div className="cq-bento">
          <div className="cq-card cq-hero cq-s5" style={{ padding: 32 }}>
            <div className="cq-lbl">Score moyen</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
              <div className="cq-num">{avgStr}</div>
              <span className="cq-unit">kg CO₂e</span>
            </div>
            <div className="cq-sub">par produit en moyenne</div>
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ height: 1, width: 40, background: "rgba(74,138,50,0.5)" }} />
              <span style={{ fontSize: 11, color: "rgba(253,252,251,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Basé sur ADEME</span>
            </div>
          </div>

          <div className="cq-card cq-s7 cq-q">
            <div className="cq-q-h">
              <span className="cq-q-t">Utilisation du quota</span>
              <span className="cq-q-n">{productsUsed} / {productLimit}</span>
            </div>
            <div style={{ width: "100%", height: 10, background: "#e5e0d8", borderRadius: 999, overflow: "hidden", margin: "12px 0", position: "relative" }}>
              <div className="cq-q-fill" style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: `${quotaPct}%`,
                background: "linear-gradient(90deg, #3a6e24, #5ca33e, #7ab856)",
                borderRadius: 999,
                transition: "width 1.4s cubic-bezier(0.4,0,0.2,1)",
                boxShadow: "0 0 8px rgba(74,138,50,0.4)",
              }} />
            </div>
            <div className="cq-q-info">
              <span className="cq-q-plan">✦ Plan Starter</span>
              <span>{quotaPct}% utilisé</span>
            </div>
          </div>
        </div>

        {/* ── Separator ── */}
        <div className="cq-sep">
          <span className="cq-sep-t">Modules</span>
          <div className="cq-sep-l" />
        </div>

        {/* ── ROW 3 — Modules ── */}
        <div className="cq-mods">
          {MODULES.map((m, i) => (
            <div key={i} className="cq-mod" onClick={() => navigate(m.r)} role="button" tabIndex={0}>
              <div className="cq-mod-icon" style={{ background: m.bg, color: m.color }} dangerouslySetInnerHTML={{ __html: m.icon }} />
              <div className="cq-mod-t">{m.t}</div>
              <div className="cq-mod-d">{m.d}</div>
            </div>
          ))}
        </div>

        {/* ── Separator ── */}
        <div className="cq-sep">
          <span className="cq-sep-t">Catalogue produits</span>
          <div className="cq-sep-l" />
        </div>

        {/* ── ROW 4 — Table ── */}
        <div className="cq-tw">
          <div className="cq-tw-h">
            <span className="cq-tw-t">Produits</span>
            <span className="cq-tw-c">{products.length} produits</span>
          </div>
          {products.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14, border: "1px solid #bbf7d0" }}>🌱</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1612", marginBottom: 4 }}>Aucun produit analysé</div>
              <div style={{ fontSize: 13, color: "#5e574f", maxWidth: 300, lineHeight: 1.5 }}>Cliquez sur "Recalculer tout" pour lancer l'analyse.</div>
            </div>
          ) : (
            <table className="cq-tbl">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th style={{ textAlign: "right" }}>CO₂e</th>
                  <th style={{ textAlign: "center" }}>Impact</th>
                  <th>Confiance</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const pill = p.carbonLabel ? PILLS[p.carbonLabel] : null;
                  const pct = p.confidence != null ? Math.round(p.confidence * 100) : null;
                  const bc = pct != null ? (pct >= 70 ? "#4a8a32" : pct >= 40 ? "#d97706" : "#ef4444") : null;
                  const score = p.carbonScoreKg != null ? (p.carbonScoreKg < 1 ? p.carbonScoreKg.toFixed(2) : p.carbonScoreKg.toFixed(1)) : "—";
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.title}</td>
                      <td style={{ textAlign: "right" }} className="cq-co2">{score}<span>kg</span></td>
                      <td style={{ textAlign: "center" }}>
                        {pill ? <span className={`cq-pill ${pill.cls}`}>{pill.icon} {pill.text}</span> : <span style={{ color: "#c4bdb2" }}>—</span>}
                      </td>
                      <td>
                        {pct != null ? (
                          <div className="cq-conf">
                            <div className="cq-conf-t">
                              <div className="cq-conf-f" style={{ width: `${pct}%`, background: bc! }} />
                            </div>
                            <span className="cq-conf-p">{pct}%</span>
                          </div>
                        ) : <span style={{ color: "#c4bdb2" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
