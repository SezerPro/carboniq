import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireFeature } from "../lib/plans/gates.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "analytics");
  try {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });

    if (!shop) return { analytics: null, comparisons: null, trend: [], benchmark: null };

    const products = await db.product.findMany({
      where: { shopId: shop.id },
      orderBy: { carbonScoreKg: "desc" },
    });

    const totalCarbonKg = products.reduce((s, p) => s + (p.carbonScoreKg ?? 0), 0);
    const avgCarbonKg = products.length > 0 ? totalCarbonKg / products.length : 0;

    const dist = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
    for (const p of products) {
      if (p.carbonLabel) dist[p.carbonLabel]++;
    }

    // Category breakdown
    const catMap = new Map<string, { code: string; totalKg: number; count: number }>();
    for (const p of products) {
      const code = p.categoryCode ?? "generic.default";
      const entry = catMap.get(code) ?? { code, totalKg: 0, count: 0 };
      entry.totalKg += p.carbonScoreKg ?? 0;
      entry.count++;
      catMap.set(code, entry);
    }
    const categoryBreakdown = [...catMap.values()].sort((a, b) => b.totalKg - a.totalKg);

    // Top polluters & cleanest
    const topPolluters = products.slice(0, 10).map((p) => ({
      id: p.id, title: p.title, carbonScoreKg: p.carbonScoreKg, carbonLabel: p.carbonLabel,
    }));
    const topClean = [...products].sort((a, b) => (a.carbonScoreKg ?? 999) - (b.carbonScoreKg ?? 999))
      .slice(0, 10).map((p) => ({
        id: p.id, title: p.title, carbonScoreKg: p.carbonScoreKg, carbonLabel: p.carbonLabel,
      }));

    // Comparisons
    const comparisons = {
      carKm: (totalCarbonKg / 0.21).toFixed(0),
      flights: (totalCarbonKg / 255).toFixed(1),
      netflixHours: (totalCarbonKg / 0.036).toFixed(0),
      smartphones: (totalCarbonKg / 70).toFixed(1),
      tshirts: (totalCarbonKg / 4).toFixed(0),
      beefKg: (totalCarbonKg / 26.6).toFixed(1),
    };

    // Monthly trend from snapshots
    const snapshots = await db.monthlySnapshot.findMany({
      where: { shopId: shop.id },
      orderBy: { month: "asc" },
      take: 12,
    });

    // Offset stats
    const offsets = await db.carbonOffset.aggregate({
      where: { shopId: shop.id, status: "COMPLETED" },
      _sum: { carbonKg: true, amountEur: true },
      _count: true,
    });

    return {
      analytics: {
        totalProducts: products.length,
        totalCarbonKg: Math.round(totalCarbonKg * 100) / 100,
        avgCarbonKg: Math.round(avgCarbonKg * 100) / 100,
        distribution: dist,
        categoryBreakdown,
        topPolluters,
        topClean,
        offsetStats: {
          totalOffsetKg: offsets._sum.carbonKg ?? 0,
          totalOffsetEur: offsets._sum.amountEur ?? 0,
          totalOrders: offsets._count,
        },
      },
      comparisons,
      trend: snapshots.map((s) => ({
        month: s.month,
        totalCarbonKg: s.totalCarbonKg,
        avgCarbonKg: s.avgCarbonKg,
        productCount: s.totalProducts,
        offsetKg: s.totalOffsetKg,
      })),
    };
  } catch (error) {
    console.error("[app.analytics] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

// ── Styles ──

const PAGE_CSS = `
.ca *{box-sizing:border-box;margin:0;padding:0}
.ca{
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;color:#2C2825;max-width:1140px;margin:0 auto;
}
.ca::before{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.3;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  background-size:128px 128px;
}
.ca>*{position:relative;z-index:1}
@keyframes caUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.ca-anim{opacity:0;animation:caUp .6s cubic-bezier(.22,1,.36,1) forwards}

.ca-glass{
  background:rgba(253,252,251,.7);backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid rgba(255,255,255,.6);border-radius:20px;
  box-shadow:0 0 0 1px rgba(164,156,144,.06),0 1px 2px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04),0 12px 48px rgba(44,40,37,.06);
  overflow:hidden;margin-bottom:16px;
}
.ca-glass-head{padding:18px 24px;border-bottom:1px solid rgba(164,156,144,.08);display:flex;align-items:center;gap:10px}
.ca-glass-head-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.ca-glass-title{font-size:14px;font-weight:700;color:#2C2825}
.ca-glass-body{padding:24px}

.ca-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.ca-metric{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.6);border-radius:18px;
  padding:22px 24px 18px;position:relative;overflow:hidden;
  box-shadow:0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
}
.ca-metric-accent{position:absolute;top:0;left:0;right:0;height:3px}
.ca-metric-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9C9488}
.ca-metric-val{font-family:'Instrument Serif',Georgia,serif;font-size:36px;line-height:1.1;letter-spacing:-.03em;color:#2C2825;margin-top:8px}
.ca-metric-val span{font-family:'DM Mono',monospace;font-size:14px;color:#9C9488;margin-left:4px;letter-spacing:0}
.ca-metric-sub{font-size:11px;color:#B8B0A6;margin-top:4px}

.ca-equiv{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ca-chip{display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(253,252,251,.5);border:1px solid rgba(255,255,255,.5);border-radius:14px;backdrop-filter:blur(8px);transition:all .2s ease}
.ca-chip:hover{background:rgba(253,252,251,.8);transform:translateY(-1px)}
.ca-chip-icon{font-size:20px;flex-shrink:0}
.ca-chip-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:500;color:#2C2825;letter-spacing:-.02em}
.ca-chip-unit{font-size:11px;color:#9C9488}

.ca-distro-row{margin-bottom:16px}.ca-distro-row:last-child{margin-bottom:0}
.ca-distro-head{display:flex;justify-content:space-between;margin-bottom:6px}
.ca-distro-label{font-size:12px;font-weight:600;color:#3D3833;display:flex;align-items:center;gap:6px}
.ca-distro-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.ca-distro-val{font-family:'DM Mono',monospace;font-size:12px;font-weight:500}
.ca-distro-track{width:100%;height:8px;background:rgba(164,156,144,.08);border-radius:99px;overflow:hidden}
.ca-distro-fill{height:100%;border-radius:99px;transition:width 1s cubic-bezier(.22,1,.36,1)}

.ca-tbl{width:100%;border-collapse:collapse}
.ca-tbl thead th{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9C9488;padding:12px 24px;text-align:left;background:rgba(74,124,89,.03);border-bottom:1px solid rgba(164,156,144,.08)}
.ca-tbl tbody tr{transition:background .12s ease}
.ca-tbl tbody tr:nth-child(even){background:rgba(164,156,144,.02)}
.ca-tbl tbody tr:hover{background:rgba(74,124,89,.04)}
.ca-tbl tbody td{padding:12px 24px;font-size:13px;color:#3D3833;border-bottom:1px solid rgba(164,156,144,.05)}
.ca-tbl tbody tr:last-child td{border-bottom:none}
.ca-cat-badge{display:inline-block;padding:2px 10px;border-radius:8px;font-size:11px;font-weight:500;font-family:'DM Mono',monospace;background:rgba(164,156,144,.08);color:#3D3833}
.ca-bar-wrap{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.ca-bar-track{width:52px;height:5px;background:rgba(164,156,144,.08);border-radius:99px;overflow:hidden}
.ca-bar-fill{height:100%;border-radius:99px;background:#4A7C59}

.ca-rankings{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.ca-rank-item{display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid rgba(164,156,144,.05);transition:background .12s ease}
.ca-rank-item:last-child{border-bottom:none}
.ca-rank-item:hover{background:rgba(74,124,89,.03)}
.ca-rank-num{width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:11px;font-weight:600;flex-shrink:0;background:rgba(164,156,144,.06);color:#9C9488}
.ca-rank-title{flex:1;font-size:13px;color:#3D3833;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ca-rank-score{font-family:'DM Mono',monospace;font-size:12px;font-weight:600;padding:3px 10px;border-radius:8px;white-space:nowrap}

.ca-trend{display:flex;align-items:flex-end;gap:6px;height:130px;padding:0 4px}
.ca-trend-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.ca-trend-val{font-family:'DM Mono',monospace;font-size:9px;color:#9C9488}
.ca-trend-bar{width:100%;max-width:44px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#4A7C59,#6BA368);transition:height .8s cubic-bezier(.22,1,.36,1);min-height:4px}
.ca-trend-label{font-size:10px;color:#B8B0A6}

@media(max-width:1024px){.ca-metrics{grid-template-columns:repeat(2,1fr)}.ca-equiv{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.ca-rankings{grid-template-columns:1fr}.ca-equiv{grid-template-columns:1fr}}
@media(max-width:600px){.ca-metrics{grid-template-columns:1fr}}
.ca-metrics .ca-metric:nth-child(1){animation-delay:.03s}.ca-metrics .ca-metric:nth-child(2){animation-delay:.06s}
.ca-metrics .ca-metric:nth-child(3){animation-delay:.09s}.ca-metrics .ca-metric:nth-child(4){animation-delay:.12s}
`;

const LABEL_COLORS: Record<string, { color: string; bg: string; dot: string }> = {
  LOW:       { color: "#15803D", bg: "rgba(74,124,89,.1)",  dot: "#4A7C59" },
  MEDIUM:    { color: "#A16207", bg: "rgba(217,119,6,.08)", dot: "#D97706" },
  HIGH:      { color: "#C2410C", bg: "rgba(194,65,12,.08)", dot: "#EA580C" },
  VERY_HIGH: { color: "#B91C1C", bg: "rgba(185,28,28,.08)", dot: "#EF4444" },
};
const LABEL_TEXT: Record<string, string> = { LOW: "Faible", MEDIUM: "Modéré", HIGH: "Élevé", VERY_HIGH: "Très élevé" };

export default function Analytics() {
  const { analytics, comparisons, trend } = useLoaderData<typeof loader>();

  if (!analytics) {
    return (
      <s-page heading="Analytiques">
        <s-section><s-paragraph>Installez d&#39;abord l&#39;app depuis le dashboard.</s-paragraph></s-section>
      </s-page>
    );
  }

  const netCarbon = analytics.totalCarbonKg - analytics.offsetStats.totalOffsetKg;
  const offsetPct = analytics.totalCarbonKg > 0
    ? Math.round((analytics.offsetStats.totalOffsetKg / analytics.totalCarbonKg) * 100) : 0;
  const fmtKg = (v: number) => v < 1 ? v.toFixed(2) : v.toFixed(1);

  return (
    <s-page heading="Analytiques">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="ca">
        {/* ── Metrics ── */}
        <div className="ca-metrics">
          {[
            { accent: "#4A7C59", label: "Empreinte totale", val: fmtKg(analytics.totalCarbonKg), unit: "kgCO₂e", sub: "tous produits confondus" },
            { accent: "#2A7A9B", label: "Score moyen", val: fmtKg(analytics.avgCarbonKg), unit: "kgCO₂e", sub: "par produit" },
            { accent: "#6D4DB8", label: "Compensé", val: fmtKg(analytics.offsetStats.totalOffsetKg), unit: "kgCO₂e", sub: `${offsetPct}% de l'empreinte` },
            { accent: netCarbon > 0 ? "#EA580C" : "#15803D", label: "Empreinte nette", val: fmtKg(Math.abs(netCarbon)), unit: "kgCO₂e", sub: netCarbon <= 0 ? "Neutre carbone !" : "restant à compenser" },
          ].map((m, i) => (
            <div className="ca-metric ca-anim" key={i} style={{ animationDelay: `${.03 + i * .04}s` }}>
              <div className="ca-metric-accent" style={{ background: m.accent }} />
              <div className="ca-metric-label">{m.label}</div>
              <div className="ca-metric-val">{m.val}<span>{m.unit}</span></div>
              <div className="ca-metric-sub">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Equivalences ── */}
        {comparisons && (
          <div className="ca-glass ca-anim" style={{ animationDelay: ".1s" }}>
            <div className="ca-glass-head">
              <div className="ca-glass-head-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
              </div>
              <div className="ca-glass-title">Votre empreinte équivaut à…</div>
            </div>
            <div className="ca-glass-body">
              <div className="ca-equiv">
                {[
                  { icon: "🚗", val: comparisons.carKm, unit: "km en voiture" },
                  { icon: "✈️", val: comparisons.flights, unit: "vols Paris-Londres" },
                  { icon: "📺", val: comparisons.netflixHours, unit: "heures de Netflix" },
                  { icon: "📱", val: comparisons.smartphones, unit: "smartphones fabriqués" },
                  { icon: "👕", val: comparisons.tshirts, unit: "t-shirts produits" },
                  { icon: "🥩", val: comparisons.beefKg, unit: "kg de boeuf" },
                ].map((c, i) => (
                  <div className="ca-chip" key={i}>
                    <span className="ca-chip-icon">{c.icon}</span>
                    <div>
                      <div className="ca-chip-val">{c.val}</div>
                      <div className="ca-chip-unit">{c.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Distribution ── */}
        <div className="ca-glass ca-anim" style={{ animationDelay: ".14s" }}>
          <div className="ca-glass-head">
            <div className="ca-glass-head-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
            </div>
            <div className="ca-glass-title">Répartition des produits</div>
          </div>
          <div className="ca-glass-body">
            {(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const).map((key) => {
              const count = analytics.distribution[key];
              const pct = analytics.totalProducts > 0 ? (count / analytics.totalProducts) * 100 : 0;
              const cfg = LABEL_COLORS[key];
              return (
                <div className="ca-distro-row" key={key}>
                  <div className="ca-distro-head">
                    <span className="ca-distro-label"><span className="ca-distro-dot" style={{ background: cfg.dot }} />{LABEL_TEXT[key]}</span>
                    <span className="ca-distro-val" style={{ color: cfg.color }}>{count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="ca-distro-track">
                    <div className="ca-distro-fill" style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, background: cfg.dot }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Category breakdown ── */}
        <div className="ca-glass ca-anim" style={{ animationDelay: ".18s" }}>
          <div className="ca-glass-head">
            <div className="ca-glass-head-icon" style={{ background: "rgba(42,122,155,.08)", color: "#2A7A9B" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
            </div>
            <div className="ca-glass-title">Impact par catégorie</div>
          </div>
          <table className="ca-tbl">
            <thead><tr>
              <th>Catégorie</th>
              <th style={{ textAlign: "right" }}>CO₂ total</th>
              <th style={{ textAlign: "right" }}>Produits</th>
              <th style={{ textAlign: "right" }}>Part</th>
            </tr></thead>
            <tbody>
              {analytics.categoryBreakdown.map((cat) => {
                const pct = analytics.totalCarbonKg > 0 ? (cat.totalKg / analytics.totalCarbonKg) * 100 : 0;
                return (
                  <tr key={cat.code}>
                    <td><span className="ca-cat-badge">{cat.code}</span></td>
                    <td style={{ textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{cat.totalKg.toFixed(1)} kgCO₂e</td>
                    <td style={{ textAlign: "right", color: COLORS.textMuted }}>{cat.count}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="ca-bar-wrap">
                        <div className="ca-bar-track"><div className="ca-bar-fill" style={{ width: `${pct}%` }} /></div>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: COLORS.textMuted }}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Rankings ── */}
        <div className="ca-rankings">
          {[
            { title: "Top impact", icon: "🔥", iconBg: "rgba(234,88,12,.08)", iconColor: "#EA580C", items: analytics.topPolluters },
            { title: "Plus vertueux", icon: "🌱", iconBg: "rgba(74,124,89,.08)", iconColor: "#4A7C59", items: analytics.topClean },
          ].map((section) => (
            <div className="ca-glass ca-anim" key={section.title} style={{ animationDelay: ".22s", marginBottom: 0 }}>
              <div className="ca-glass-head">
                <div className="ca-glass-head-icon" style={{ background: section.iconBg, color: section.iconColor }}>{section.icon}</div>
                <div className="ca-glass-title">{section.title}</div>
              </div>
              <div style={{ padding: "4px 0" }}>
                {section.items.slice(0, 5).map((p, i) => {
                  const cfg = p.carbonLabel ? LABEL_COLORS[p.carbonLabel] : null;
                  return (
                    <div className="ca-rank-item" key={p.id}>
                      <span className="ca-rank-num">{i + 1}</span>
                      <span className="ca-rank-title">{p.title}</span>
                      {cfg && (
                        <span className="ca-rank-score" style={{ background: cfg.bg, color: cfg.color }}>
                          {p.carbonScoreKg != null ? `${fmtKg(p.carbonScoreKg)} kgCO₂e` : "—"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Monthly trend ── */}
        {trend.length > 0 && (
          <div className="ca-glass ca-anim" style={{ animationDelay: ".26s" }}>
            <div className="ca-glass-head">
              <div className="ca-glass-head-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="ca-glass-title">Évolution mensuelle</div>
            </div>
            <div className="ca-glass-body">
              <div className="ca-trend">
                {trend.map((m) => {
                  const maxKg = Math.max(...trend.map((t) => t.totalCarbonKg), 1);
                  const h = (m.totalCarbonKg / maxKg) * 100;
                  return (
                    <div className="ca-trend-col" key={m.month}>
                      <span className="ca-trend-val">{m.totalCarbonKg.toFixed(0)}</span>
                      <div className="ca-trend-bar" style={{ height: `${h}%` }} />
                      <span className="ca-trend-label">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
