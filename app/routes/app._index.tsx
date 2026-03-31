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
import { hasAccess, FEATURES, type PlanTier } from "../lib/plans/constants";
import { getPlanTier } from "../lib/plans/gates.server";
import { computeAlerts } from "../lib/notifications/alerts.server";
import { AlertBanner } from "../components/AlertBanner";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
    include: { subscription: true },
  });

  // Auto-create shop if first visit
  if (!shop) {
    const newShop = await db.shop.create({
      data: {
        shopDomain: session.shop,
        accessToken: "",  // Managed by Shopify session, not stored
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

  const tier = getPlanTier(shop.plan, shop.planStatus);
  const alerts = await computeAlerts(shop, stats, tier);

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
    planTier: tier,
    alerts,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await admin.graphql(
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const edges: any[] = json.data?.products?.edges ?? [];
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
/* ── Reset ── */
.cq *{box-sizing:border-box;margin:0;padding:0}
.cq{
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  color:#2C2825;
  max-width:1140px;
  margin:0 auto;
  position:relative;
}

/* ── Grain texture overlay ── */
.cq::before{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.35;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  background-size:128px 128px;
}
.cq>*{position:relative;z-index:1}

/* ── Animations ── */
@keyframes cqUp{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes cqFade{from{opacity:0}to{opacity:1}}
@keyframes cqSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes cqPulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
@keyframes cqShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes cqRingDraw{from{stroke-dashoffset:283}to{stroke-dashoffset:var(--ring-offset,283)}}
@keyframes cqGlow{0%,100%{filter:blur(40px) brightness(1)}50%{filter:blur(50px) brightness(1.2)}}
@keyframes cqFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.cq-anim{opacity:0;animation:cqUp .7s cubic-bezier(.22,1,.36,1) forwards}

/* ── Glass card base ── */
.cq-glass{
  background:rgba(253,252,251,.72);
  backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid rgba(255,255,255,.6);
  border-radius:20px;
  box-shadow:
    0 0 0 1px rgba(164,156,144,.06),
    0 1px 2px rgba(44,40,37,.04),
    0 4px 16px rgba(44,40,37,.04),
    0 12px 48px rgba(44,40,37,.06);
  transition:all .3s cubic-bezier(.22,1,.36,1);
}
.cq-glass:hover{
  box-shadow:
    0 0 0 1px rgba(74,124,89,.1),
    0 2px 4px rgba(44,40,37,.06),
    0 8px 24px rgba(44,40,37,.06),
    0 20px 60px rgba(44,40,37,.08);
  transform:translateY(-2px);
}

/* ── Bento grid ── */
.cq-bento{
  display:grid;
  grid-template-columns:repeat(12,1fr);
  grid-auto-rows:auto;
  gap:12px;
  margin-bottom:12px;
}
.cq-span-8{grid-column:span 8}
.cq-span-4{grid-column:span 4}
.cq-span-3{grid-column:span 3}
.cq-span-6{grid-column:span 6}

/* ── Hero card — dark with mesh gradient ── */
.cq-hero{
  position:relative;overflow:visible;
  background:#1E1B18;
  border:1px solid rgba(74,124,89,.15);
  border-radius:24px;
  padding:44px 40px 36px;
  min-height:280px;
  display:flex;flex-direction:column;justify-content:space-between;
}
/* Clip only the orbs, not the content */
.cq-hero::after{content:'';position:absolute;inset:0;border-radius:24px;pointer-events:none;box-shadow:inset 0 0 0 0 transparent;overflow:hidden;z-index:0}
/* Mesh gradient orbs — contained in a clipped layer */
.cq-hero-orbs{position:absolute;inset:0;border-radius:24px;overflow:hidden;pointer-events:none;z-index:1}
.cq-hero-orb{position:absolute;border-radius:50%;pointer-events:none;animation:cqGlow 6s ease-in-out infinite}
.cq-hero-orb--1{width:320px;height:320px;top:-100px;right:-60px;background:radial-gradient(circle,rgba(74,124,89,.22) 0%,transparent 70%)}
.cq-hero-orb--2{width:200px;height:200px;bottom:-60px;left:-40px;background:radial-gradient(circle,rgba(74,124,89,.1) 0%,transparent 70%);animation-delay:3s}
.cq-hero-orb--3{width:140px;height:140px;top:50%;left:40%;background:radial-gradient(circle,rgba(106,163,104,.08) 0%,transparent 70%);animation-delay:1.5s}
.cq-hero-content{position:relative;z-index:2}

/* Score ring SVG */
.cq-ring-wrap{
  position:absolute;top:28px;right:32px;z-index:2;
  width:120px;height:120px;
  animation:cqFloat 5s ease-in-out infinite;
}
.cq-ring-bg{fill:none;stroke:rgba(255,255,255,.06);stroke-width:6}
.cq-ring-fg{
  fill:none;stroke:url(#cqRingGrad);stroke-width:6;
  stroke-linecap:round;
  stroke-dasharray:283;
  stroke-dashoffset:283;
  animation:cqRingDraw 1.5s cubic-bezier(.22,1,.36,1) .5s forwards;
  filter:drop-shadow(0 0 6px rgba(74,124,89,.4));
}
.cq-ring-val{
  font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
  fill:rgba(253,252,251,.5);text-anchor:middle;dominant-baseline:central;
}
.cq-ring-label{
  font-family:'DM Sans',sans-serif;font-size:8px;font-weight:600;
  fill:rgba(253,252,251,.25);text-anchor:middle;letter-spacing:.08em;text-transform:uppercase;
}

.cq-hero-score{
  font-family:'Instrument Serif',Georgia,serif;
  font-size:88px;line-height:1.2;letter-spacing:-.05em;
  color:#FDFCFB;font-variant-numeric:tabular-nums;
  margin:8px 0 6px;
  display:block;
}
.cq-hero-unit{font-family:'DM Mono',monospace;font-size:15px;color:rgba(253,252,251,.3);letter-spacing:-.01em}
.cq-hero-sub{font-size:12.5px;color:rgba(253,252,251,.25);margin-top:6px}
.cq-hero-source{
  display:inline-flex;align-items:center;gap:8px;
  font-family:'DM Mono',monospace;font-size:10px;color:rgba(253,252,251,.2);
  letter-spacing:.08em;text-transform:uppercase;
  padding-top:20px;border-top:1px solid rgba(253,252,251,.05);
  position:relative;z-index:2;
}
.cq-hero-dot{width:6px;height:6px;border-radius:50%;background:#4A7C59;animation:cqPulse 3s ease-in-out infinite}

/* Distribution bar inside hero */
.cq-hero-distro{
  display:flex;height:6px;border-radius:99px;overflow:hidden;
  margin-top:16px;gap:2px;position:relative;z-index:2;
}
.cq-hero-distro-seg{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.22,1,.36,1);min-width:3px}
.cq-hero-distro-legend{
  display:flex;gap:16px;margin-top:10px;position:relative;z-index:2;
}
.cq-hero-distro-item{display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(253,252,251,.35)}
.cq-hero-distro-item .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* ── Stat cards (glass) ── */
.cq-stat{padding:24px 28px;position:relative;overflow:hidden}
.cq-stat-accent{position:absolute;top:0;left:0;right:0;height:3px}
.cq-stat-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9C9488;display:flex;align-items:center;gap:6px}
.cq-stat-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;box-shadow:0 0 8px currentColor}
.cq-stat-num{font-family:'Instrument Serif',Georgia,serif;font-size:48px;line-height:1.1;letter-spacing:-.03em;margin-top:10px}
.cq-stat-meta{display:flex;align-items:center;justify-content:space-between;margin-top:10px}
.cq-stat-pct{
  font-family:'DM Mono',monospace;font-size:11px;font-weight:500;
  padding:3px 10px;border-radius:99px;
}
.cq-stat-bar{width:100%;height:6px;border-radius:99px;background:rgba(164,156,144,.08);margin-top:12px;overflow:hidden}
.cq-stat-bar-fill{height:100%;border-radius:99px;transition:width 1.2s cubic-bezier(.22,1,.36,1)}
/* Dominant stat card */
.cq-stat--big{grid-column:span 6}
.cq-stat--big .cq-stat-num{font-size:64px}
.cq-stat--big .cq-stat-bar{height:8px}

/* ── Quota card — arc gauge ── */
.cq-quota{padding:28px 32px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cq-quota-arc{width:160px;height:90px;margin-bottom:16px;position:relative}
.cq-quota-arc svg{overflow:visible}
.cq-arc-bg{fill:none;stroke:rgba(164,156,144,.1);stroke-width:8;stroke-linecap:round}
.cq-arc-fg{
  fill:none;stroke:url(#cqArcGrad);stroke-width:8;stroke-linecap:round;
  stroke-dasharray:var(--arc-total);stroke-dashoffset:var(--arc-offset);
  transition:stroke-dashoffset 1.5s cubic-bezier(.22,1,.36,1);
  filter:drop-shadow(0 0 8px rgba(74,124,89,.3));
}
.cq-quota-pct{
  position:absolute;bottom:0;left:50%;transform:translateX(-50%);
  font-family:'DM Mono',monospace;font-size:24px;font-weight:500;color:#2C2825;
}
.cq-quota-pct span{font-size:13px;color:#B8B0A6}
.cq-quota-detail{
  font-family:'DM Mono',monospace;font-size:13px;color:#9C9488;margin-bottom:14px;
}
.cq-quota-detail strong{color:#2C2825;font-weight:600}
.cq-plan-chip{
  display:inline-flex;align-items:center;gap:6px;
  font-size:11px;font-weight:600;padding:4px 14px;
  background:rgba(74,124,89,.08);color:#4A7C59;
  border-radius:99px;border:1px solid rgba(74,124,89,.15);
  backdrop-filter:blur(8px);
}
.cq-plan-chip::before{content:'';width:6px;height:6px;border-radius:50%;background:#4A7C59}

/* ── Section separator ── */
.cq-sep{display:flex;align-items:center;gap:14px;margin:32px 0 16px}
.cq-sep-text{
  font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4A7C59;white-space:nowrap;
  padding:3px 10px;background:rgba(74,124,89,.06);border-radius:6px;
}
.cq-sep-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(74,124,89,.15),transparent)}

/* ── Module cards — glassmorphism ── */
.cq-mods{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
.cq-mod--featured{
  border-left:3px solid rgba(74,124,89,.4);
  background:rgba(253,252,251,.7);
}
.cq-mod--featured:hover{border-left-color:#4A7C59}
.cq-mod{
  background:rgba(253,252,251,.55);
  backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.5);
  border-radius:16px;padding:18px 20px;
  cursor:pointer;
  transition:all .25s cubic-bezier(.22,1,.36,1);
  text-decoration:none;color:inherit;
  display:flex;flex-direction:column;gap:12px;
  position:relative;overflow:hidden;
  opacity:0;animation:cqUp .6s cubic-bezier(.22,1,.36,1) forwards;
}
.cq-mod::before{
  content:'';position:absolute;inset:0;border-radius:16px;
  background:radial-gradient(ellipse at 30% 0%,rgba(255,255,255,.4),transparent 60%);
  pointer-events:none;
}
.cq-mod:hover{
  background:rgba(253,252,251,.8);
  border-color:rgba(74,124,89,.2);
  transform:translateY(-3px) scale(1.01);
  box-shadow:
    0 0 0 1px rgba(74,124,89,.08),
    0 4px 12px rgba(44,40,37,.06),
    0 16px 48px rgba(44,40,37,.08);
}
.cq-mod-top{display:flex;justify-content:space-between;align-items:flex-start}
.cq-mod-icon{
  width:38px;height:38px;border-radius:12px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  transition:all .3s cubic-bezier(.22,1,.36,1);
  position:relative;
}
.cq-mod-icon::after{
  content:'';position:absolute;inset:-2px;border-radius:14px;
  background:inherit;opacity:.3;filter:blur(8px);z-index:-1;
  transition:opacity .3s ease;
}
.cq-mod:hover .cq-mod-icon{transform:scale(1.1) rotate(-3deg)}
.cq-mod:hover .cq-mod-icon::after{opacity:.5}
.cq-mod-icon svg{width:17px;height:17px}
.cq-mod-t{font-size:13px;font-weight:600;color:#2C2825;line-height:1.2}
.cq-mod-d{font-size:11.5px;color:#9C9488}
.cq-mod-arrow{
  font-size:13px;color:#C4BDB2;
  transition:all .25s cubic-bezier(.22,1,.36,1);
  opacity:0;transform:translateX(-4px);
}
.cq-mod:hover .cq-mod-arrow{opacity:1;transform:translateX(0);color:#4A7C59}
.cq-mod-lock{
  font-size:8px;font-weight:700;padding:2px 7px;border-radius:5px;
  background:rgba(254,243,199,.8);color:#92400E;
  border:1px solid rgba(253,230,138,.6);
  text-transform:uppercase;letter-spacing:.06em;
  backdrop-filter:blur(4px);
}
.cq-mod--locked{opacity:.5}
.cq-mod--locked:hover{opacity:.65;transform:translateY(-1px)}

/* ── Table — glass ── */
.cq-tw{
  background:rgba(253,252,251,.65);
  backdrop-filter:blur(20px) saturate(1.3);
  -webkit-backdrop-filter:blur(20px) saturate(1.3);
  border:1px solid rgba(255,255,255,.5);
  border-radius:20px;overflow:hidden;
  box-shadow:0 0 0 1px rgba(164,156,144,.05),0 4px 16px rgba(44,40,37,.04),0 12px 48px rgba(44,40,37,.05);
  opacity:0;animation:cqUp .7s cubic-bezier(.22,1,.36,1) .15s forwards;
}
.cq-tw-head{
  display:flex;justify-content:space-between;align-items:center;
  padding:22px 28px;border-bottom:1px solid rgba(164,156,144,.1);
}
.cq-tw-title{font-size:15px;font-weight:700;color:#2C2825}
.cq-tw-badge{
  font-family:'DM Mono',monospace;font-size:11px;color:#9C9488;
  padding:4px 12px;background:rgba(164,156,144,.06);border-radius:99px;
}
.cq-tbl{width:100%;border-collapse:collapse}
.cq-tbl thead th{
  font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:#7A746C;padding:14px 28px;text-align:left;
  background:rgba(74,124,89,.04);
  border-bottom:2px solid rgba(74,124,89,.1);
}
.cq-tbl tbody tr{transition:all .15s ease;position:relative}
.cq-tbl tbody tr:nth-child(even){background:rgba(164,156,144,.025)}
.cq-tbl tbody tr:hover{background:rgba(74,124,89,.05);box-shadow:inset 4px 0 0 #4A7C59}
.cq-tbl tbody td{
  padding:14px 28px;font-size:13px;color:#3D3833;
  border-bottom:1px solid rgba(164,156,144,.06);
}
.cq-tbl tbody tr:last-child td{border-bottom:none}

/* CO₂ value */
.cq-co2{font-family:'DM Mono',monospace;font-size:14px;font-weight:500;letter-spacing:-.01em;color:#2C2825}
.cq-co2-unit{font-family:'DM Mono',monospace;font-size:11px;color:#9C9488;margin-left:3px;font-weight:400}

/* Outlier row highlighting */
.cq-row-alert{background:rgba(185,28,28,.04)!important}
.cq-row-alert:hover{background:rgba(185,28,28,.07)!important;box-shadow:inset 4px 0 0 #B91C1C!important}
.cq-row-alert .cq-co2{color:#B91C1C;font-size:15px;font-weight:600}
.cq-row-good{background:rgba(74,124,89,.03)!important}
.cq-row-good:hover{background:rgba(74,124,89,.06)!important}

/* ── Pills ── */
.cq-pill{
  display:inline-flex;align-items:center;gap:5px;padding:4px 12px;
  border-radius:99px;font-size:11px;font-weight:600;
  backdrop-filter:blur(8px);
  border:1px solid transparent;
}
.cq-pill-low{background:rgba(74,124,89,.12);color:#15803D;border-color:rgba(74,124,89,.15)}
.cq-pill-med{background:rgba(217,119,6,.1);color:#A16207;border-color:rgba(217,119,6,.12)}
.cq-pill-high{background:rgba(194,65,12,.1);color:#C2410C;border-color:rgba(194,65,12,.12)}
.cq-pill-vh{background:rgba(185,28,28,.1);color:#B91C1C;border-color:rgba(185,28,28,.12)}
.cq-pill-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0}

/* ── Confidence ── */
.cq-conf{display:flex;align-items:center;gap:10px}
.cq-conf-track{width:72px;height:6px;background:rgba(164,156,144,.1);border-radius:99px;overflow:hidden;flex-shrink:0}
.cq-conf-fill{height:100%;border-radius:99px;transition:width .8s cubic-bezier(.22,1,.36,1)}
.cq-conf-val{font-family:'DM Mono',monospace;font-size:12px;font-weight:500;color:#7A746C}
/* Confidence color-coded text */
.cq-conf--high .cq-conf-val{color:#15803D}
.cq-conf--mid .cq-conf-val{color:#A16207}
.cq-conf--low .cq-conf-val{color:#B91C1C}

/* ── Empty ── */
.cq-empty{display:flex;flex-direction:column;align-items:center;padding:64px 24px;text-align:center}
.cq-empty-icon{
  width:64px;height:64px;border-radius:20px;
  background:rgba(74,124,89,.06);
  border:1px solid rgba(74,124,89,.1);
  display:flex;align-items:center;justify-content:center;
  font-size:26px;margin-bottom:18px;
  backdrop-filter:blur(8px);
}
.cq-empty-t{font-size:16px;font-weight:700;color:#2C2825;margin-bottom:6px}
.cq-empty-d{font-size:13px;color:#9C9488;max-width:300px;line-height:1.6}

/* ── Responsive ── */
@media(max-width:1024px){
  .cq-bento{grid-template-columns:repeat(6,1fr)}
  .cq-span-8{grid-column:span 6}.cq-span-4{grid-column:span 6}
  .cq-span-3{grid-column:span 3}.cq-span-6{grid-column:span 6}
  .cq-mods{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:768px){
  .cq-bento{grid-template-columns:1fr}
  .cq-span-8,.cq-span-4,.cq-span-3,.cq-span-6,.cq-stat--big{grid-column:span 1}
  .cq-stat--big .cq-stat-num{font-size:48px}
  .cq-mods{grid-template-columns:repeat(2,1fr)}
  .cq-hero-score{font-size:64px}
  .cq-ring-wrap{width:90px;height:90px;top:20px;right:24px}
}
@media(max-width:480px){
  .cq-mods{grid-template-columns:1fr}
}

/* ── Stagger ── */
.cq-bento .cq-glass:nth-child(1){animation-delay:.04s}
.cq-bento .cq-glass:nth-child(2){animation-delay:.08s}
.cq-bento .cq-glass:nth-child(3){animation-delay:.12s}
.cq-bento .cq-glass:nth-child(4){animation-delay:.16s}
.cq-bento .cq-glass:nth-child(5){animation-delay:.20s}
.cq-mods .cq-mod:nth-child(1){animation-delay:.04s}
.cq-mods .cq-mod:nth-child(2){animation-delay:.07s}
.cq-mods .cq-mod:nth-child(3){animation-delay:.10s}
.cq-mods .cq-mod:nth-child(4){animation-delay:.13s}
.cq-mods .cq-mod:nth-child(5){animation-delay:.16s}
.cq-mods .cq-mod:nth-child(6){animation-delay:.19s}
.cq-mods .cq-mod:nth-child(7){animation-delay:.22s}
.cq-mods .cq-mod:nth-child(8){animation-delay:.25s}
.cq-mods .cq-mod:nth-child(9){animation-delay:.28s}
.cq-mods .cq-mod:nth-child(10){animation-delay:.31s}
.cq-mods .cq-mod:nth-child(11){animation-delay:.34s}
.cq-mods .cq-mod:nth-child(12){animation-delay:.37s}
`;

// ── Modules ──

const MODULES = [
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>', color: "#4A7C59", bg: "rgba(74,124,89,.12)", t: "Analytiques", d: "Tendances & insights", r: "/app/analytics", gate: "analytics" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 9-8 9z"/></svg>', color: "#4A7C59", bg: "rgba(74,124,89,.12)", t: "Réduire", d: "Conseils IA", r: "/app/reduction", gate: "reduction_basic" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>', color: "#3B6FC0", bg: "rgba(59,111,192,.1)", t: "DPP", d: "Passeport produit EU", r: "/app/dpp", gate: "dpp" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>', color: "#7C5DB8", bg: "rgba(124,93,184,.1)", t: "Rapports", d: "RSE / CSRD", r: "/app/reports", gate: "reports_monthly" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', color: "#2D8659", bg: "rgba(45,134,89,.1)", t: "Conformité", d: "EU Green Claims", r: "/app/compliance", gate: "compliance" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>', color: "#B8860B", bg: "rgba(184,134,11,.1)", t: "A/B Test", d: "Optimiser les badges", r: "/app/abtest", gate: "abtest" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>', color: "#96722D", bg: "rgba(150,114,45,.1)", t: "ROI", d: "Performance carbone", r: "/app/roi", gate: "roi" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>', color: "#2A7A9B", bg: "rgba(42,122,155,.1)", t: "Benchmark", d: "Position secteur", r: "/app/benchmark", gate: "benchmark" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>', color: "#6D4DB8", bg: "rgba(109,77,184,.1)", t: "Scope 3", d: "Supply chain", r: "/app/scope3", gate: "scope3" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>', color: "#0D8B7E", bg: "rgba(13,139,126,.1)", t: "Impact", d: "Portail public", r: "/app/impact", gate: "impact_portal" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>', color: "#64748B", bg: "rgba(100,116,139,.08)", t: "Paramètres", d: "Configuration", r: "/app/settings", gate: "settings" as const },
  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>', color: "#4A7C59", bg: "rgba(74,124,89,.12)", t: "Plans", d: "Tarification", r: "/app/pricing", gate: "dashboard" as const },
];

// ── Labels ──

const LABELS: Record<string, { color: string; bg: string; accent: string; dot: string; text: string; cls: string }> = {
  LOW:       { color: "#15803D", bg: "rgba(74,124,89,.1)",  accent: "linear-gradient(90deg,#4A7C59,#6BA368)", dot: "#4A7C59", text: "Faible",     cls: "cq-pill-low" },
  MEDIUM:    { color: "#A16207", bg: "rgba(217,119,6,.08)", accent: "linear-gradient(90deg,#D97706,#F59E0B)", dot: "#D97706", text: "Modéré",     cls: "cq-pill-med" },
  HIGH:      { color: "#C2410C", bg: "rgba(194,65,12,.08)", accent: "linear-gradient(90deg,#C2410C,#EA580C)", dot: "#EA580C", text: "Élevé",      cls: "cq-pill-high" },
  VERY_HIGH: { color: "#B91C1C", bg: "rgba(185,28,28,.08)", accent: "linear-gradient(90deg,#B91C1C,#EF4444)", dot: "#EF4444", text: "Très élevé", cls: "cq-pill-vh" },
};

// ── Component ──

export default function Index() {
  const { stats, products, subscription, planTier, alerts } = useLoaderData<typeof loader>();
  const plan = (planTier ?? "FREE") as PlanTier;
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isRecalculating =
    fetcher.state !== "idle" && fetcher.formData?.get("intent") === "recalculate";

  useEffect(() => {
    if (fetcher.data && "processed" in fetcher.data) {
      shopify.toast.show(`${fetcher.data.processed} produits recalculés`);
    }
  }, [fetcher.data, shopify]);

  // Polaris overrides + fonts
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cq-global-override";
    style.textContent = `
      html,body,#app,[data-shopify-app-init]{background:#F5F0EB!important}
      .Polaris-Frame__Main{background:#F5F0EB!important}
      .Polaris-Frame{background:#F5F0EB!important}
    `;
    document.head.appendChild(style);

    if (!document.getElementById("cq-fonts")) {
      const link = document.createElement("link");
      link.id = "cq-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap";
      document.head.appendChild(link);
    }

    // Counter animation
    const nums = document.querySelectorAll("[data-cq-count]");
    nums.forEach((el) => {
      const target = parseFloat(el.getAttribute("data-cq-count") || "0");
      if (isNaN(target) || target === 0) return;
      const isInt = target % 1 === 0;
      let start = 0;
      const duration = 1000;
      const step = (ts: number) => {
        if (!start) start = ts;
        const t = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = isInt ? Math.round(eased * target).toString() : (eased * target).toFixed(target < 1 ? 2 : 1);
        if (t < 1) requestAnimationFrame(step);
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

  // Ring offset: 283 = full circle, 0 = empty. Lower offset = more filled.
  const ringOffset = stats.total > 0 ? Math.round(283 - (283 * quotaPct / 100)) : 283;

  return (
    <s-page heading="Carboniq">
      <s-button
        slot="primary-action"
        onClick={handleRecalculate}
        {...(isRecalculating ? { loading: true } : {})}
      >
        Recalculer tout
      </s-button>

      <style dangerouslySetInnerHTML={{ __html: CSS + `\n.cq-ring-fg{--ring-offset:${ringOffset}}` }} />

      <div className="cq">

        {/* ── Alerts ── */}
        {alerts && alerts.length > 0 && <AlertBanner alerts={alerts} />}

        {/* ── Bento Row 1 — Hero + Quota ── */}
        <div className="cq-bento">
          <div className="cq-hero cq-span-8 cq-anim">
            <div className="cq-hero-orbs">
              <div className="cq-hero-orb cq-hero-orb--1" />
              <div className="cq-hero-orb cq-hero-orb--2" />
              <div className="cq-hero-orb cq-hero-orb--3" />
            </div>

            {/* SVG ring indicator */}
            <div className="cq-ring-wrap">
              <svg viewBox="0 0 100 100" width="100%" height="100%">
                <defs>
                  <linearGradient id="cqRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6BA368" />
                    <stop offset="100%" stopColor="#4A7C59" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="45" className="cq-ring-bg" />
                <circle cx="50" cy="50" r="45" className="cq-ring-fg" transform="rotate(-90 50 50)" />
                <text x="50" y="46" className="cq-ring-val">{quotaPct}%</text>
                <text x="50" y="58" className="cq-ring-label">quota</text>
              </svg>
            </div>

            <div className="cq-hero-content">
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase" as const, color: "rgba(253,252,251,.35)" }}>
                Score carbone moyen
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div className="cq-hero-score" data-cq-count={avgStr}>{avgStr}</div>
                <span className="cq-hero-unit">kgCO₂e</span>
              </div>
              <div className="cq-hero-sub">
                par produit · {stats.total} produit{stats.total !== 1 ? "s" : ""} analysé{stats.total !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Distribution bar */}
            {stats.total > 0 && (
              <>
                <div className="cq-hero-distro">
                  {(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const).map((key) => {
                    const pct = Math.round((stats[key] / stats.total) * 100);
                    if (pct === 0) return null;
                    const colors: Record<string, string> = { LOW: "#4A7C59", MEDIUM: "#D97706", HIGH: "#EA580C", VERY_HIGH: "#EF4444" };
                    return <div key={key} className="cq-hero-distro-seg" style={{ width: `${pct}%`, background: colors[key], opacity: .7 }} />;
                  })}
                </div>
                <div className="cq-hero-distro-legend">
                  {(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const).map((key) => {
                    const names: Record<string, string> = { LOW: "Faible", MEDIUM: "Modéré", HIGH: "Élevé", VERY_HIGH: "Très élevé" };
                    const colors: Record<string, string> = { LOW: "#4A7C59", MEDIUM: "#D97706", HIGH: "#EA580C", VERY_HIGH: "#EF4444" };
                    return (
                      <div key={key} className="cq-hero-distro-item">
                        <span className="dot" style={{ background: colors[key] }} />
                        {names[key]} {stats[key]}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="cq-hero-source">
              <span className="cq-hero-dot" />
              Données ADEME · Temps réel
            </div>
          </div>

          <div className="cq-glass cq-span-4 cq-quota cq-anim" style={{ animationDelay: ".06s" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" as const, color: "#B8B0A6", marginBottom: 8 }}>
              Quota produits
            </div>
            {/* Arc gauge SVG */}
            <div className="cq-quota-arc">
              <svg viewBox="0 0 160 90" width="160" height="90">
                <defs>
                  <linearGradient id="cqArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3A6E24" />
                    <stop offset="50%" stopColor="#4A7C59" />
                    <stop offset="100%" stopColor="#6BA368" />
                  </linearGradient>
                </defs>
                <path d="M16 80 A64 64 0 0 1 144 80" className="cq-arc-bg" style={{ "--arc-total": "201", "--arc-offset": "0" } as React.CSSProperties} />
                <path d="M16 80 A64 64 0 0 1 144 80" className="cq-arc-fg" style={{ "--arc-total": "201", "--arc-offset": `${Math.round(201 - (201 * quotaPct / 100))}` } as React.CSSProperties} />
              </svg>
              <div className="cq-quota-pct">{quotaPct}<span>%</span></div>
            </div>
            <div className="cq-quota-detail">
              <strong>{productsUsed}</strong> / {productLimit} produits
            </div>
            <span className="cq-plan-chip">
              Plan {plan.charAt(0) + plan.slice(1).toLowerCase()}
            </span>
          </div>
        </div>

        {/* ── Bento Row 2 — Stat cards (dominant = bigger) ── */}
        <div className="cq-bento">
          {(() => {
            const keys = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
            const maxKey = keys.reduce((a, b) => (stats[a] >= stats[b] ? a : b));
            return keys.map((key, i) => {
              const lb = LABELS[key];
              const count = stats[key];
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              const isDominant = key === maxKey && stats.total > 0;
              return (
                <div className={`cq-glass cq-stat cq-anim ${isDominant ? "cq-stat--big" : "cq-span-3"}`} key={key} style={{ animationDelay: `${.04 + i * .05}s` }}>
                  <div className="cq-stat-accent" style={{ background: lb.accent }} />
                  <div className="cq-stat-label">
                    <span className="cq-stat-dot" style={{ background: lb.dot, color: lb.dot }} />
                    {lb.text}
                    {isDominant && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: lb.bg, color: lb.color, marginLeft: 4 }}>DOMINANT</span>}
                  </div>
                  <div className="cq-stat-num" style={{ color: lb.color }} data-cq-count={count}>{count}</div>
                  <div className="cq-stat-meta">
                    <span className="cq-stat-pct" style={{ background: lb.bg, color: lb.color }}>{pct}%</span>
                    {isDominant && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#9C9488" }}>{count} sur {stats.total}</span>}
                  </div>
                  <div className="cq-stat-bar">
                    <div className="cq-stat-bar-fill" style={{ width: `${pct}%`, background: lb.accent }} />
                  </div>
                </div>
              );
            });
          })()}
        </div>

        {/* ── Modules ── */}
        <div className="cq-sep">
          <span className="cq-sep-text">Modules</span>
          <div className="cq-sep-line" />
        </div>

        <div className="cq-mods">
          {MODULES.map((m, i) => {
            const feature = FEATURES[m.gate];
            const locked = feature ? !hasAccess(plan, feature.requiredPlan) : false;
            return (
              <div
                key={i}
                className={`cq-mod ${locked ? "cq-mod--locked" : ""} ${i < 4 && !locked ? "cq-mod--featured" : ""}`}
                onClick={() => navigate(locked ? "/app/pricing" : m.r)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(locked ? "/app/pricing" : m.r); }}
                role="button"
                tabIndex={0}
              >
                <div className="cq-mod-top">
                  <div className="cq-mod-icon" style={{ background: m.bg, color: m.color }} dangerouslySetInnerHTML={{ __html: m.icon }} />
                  {locked ? (
                    <span className="cq-mod-lock">{feature!.requiredPlan}</span>
                  ) : (
                    <span className="cq-mod-arrow">→</span>
                  )}
                </div>
                <div>
                  <div className="cq-mod-t">{locked ? "🔒 " : ""}{m.t}</div>
                  <div className="cq-mod-d">{locked ? "Upgrade requis" : m.d}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Products table ── */}
        <div className="cq-sep">
          <span className="cq-sep-text">Catalogue produits</span>
          <div className="cq-sep-line" />
        </div>

        <div className="cq-tw">
          <div className="cq-tw-head">
            <span className="cq-tw-title">Produits</span>
            <span className="cq-tw-badge">{products.length} produit{products.length !== 1 ? "s" : ""}</span>
          </div>
          {products.length === 0 ? (
            <div className="cq-empty">
              <div className="cq-empty-icon">🌱</div>
              <div className="cq-empty-t">Aucun produit analysé</div>
              <div className="cq-empty-d">Cliquez sur &laquo; Recalculer tout &raquo; pour lancer l&rsquo;analyse carbone de votre catalogue.</div>
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
                  const lb = p.carbonLabel ? LABELS[p.carbonLabel] : null;
                  const pct = p.confidence != null ? Math.round(p.confidence * 100) : null;
                  const bc = pct != null ? (pct >= 70 ? "#4A7C59" : pct >= 40 ? "#D97706" : "#EF4444") : null;
                  const confClass = pct != null ? (pct >= 70 ? "cq-conf--high" : pct >= 40 ? "cq-conf--mid" : "cq-conf--low") : "";
                  const score = p.carbonScoreKg != null
                    ? (p.carbonScoreKg < 1 ? p.carbonScoreKg.toFixed(2) : p.carbonScoreKg.toFixed(1))
                    : "\u2014";
                  const unit = p.carbonScoreKg != null
                    ? (p.carbonScoreKg < 1 ? "gCO\u2082e" : "kgCO\u2082e")
                    : "";
                  // Row class: highlight outliers
                  const isAlert = p.carbonLabel === "VERY_HIGH" || p.carbonLabel === "HIGH";
                  const isGood = p.carbonLabel === "LOW";
                  const rowCls = isAlert ? "cq-row-alert" : isGood ? "cq-row-good" : "";
                  return (
                    <tr key={p.id} className={rowCls}>
                      <td style={{ fontWeight: 500 }}>{p.title}</td>
                      <td style={{ textAlign: "right" }}>
                        <span className="cq-co2">{score}</span>
                        <span className="cq-co2-unit">{unit}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {lb ? (
                          <span className={`cq-pill ${lb.cls}`}>
                            <span className="cq-pill-dot" style={{ background: lb.dot }} />
                            {lb.text}
                          </span>
                        ) : (
                          <span style={{ color: "#C4BDB2" }}>{"\u2014"}</span>
                        )}
                      </td>
                      <td>
                        {pct != null ? (
                          <div className={`cq-conf ${confClass}`}>
                            <div className="cq-conf-track">
                              <div className="cq-conf-fill" style={{ width: `${pct}%`, background: bc! }} />
                            </div>
                            <span className="cq-conf-val">{pct}%</span>
                          </div>
                        ) : (
                          <span style={{ color: "#C4BDB2" }}>{"\u2014"}</span>
                        )}
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
