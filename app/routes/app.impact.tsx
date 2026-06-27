import { useState, useEffect, useCallback } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireFeature } from "../lib/plans/gates.server";
import { getShopImpactStats, getImpactTimeline } from "../lib/impact/impact.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "impact_portal");
  try {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });

    if (!shop) {
      return {
        shop: null,
        stats: null,
        timeline: [],
        trend: [],
        certificates: 0,
        milestones: [],
        portalUrl: "",
      };
    }

    const stats = await getShopImpactStats(shop.id);

    const timeline = await getImpactTimeline(shop.id, 20);

    // Offset stats
    const offsetAgg = await db.carbonOffset.aggregate({
      where: { shopId: shop.id, status: "COMPLETED" },
      _sum: { carbonKg: true },
      _count: true,
    });

    // Certificate count
    const certCount = await db.certificate.count({
      where: { shopId: shop.id },
    });

    // Monthly snapshots
    const snapshots = await db.monthlySnapshot.findMany({
      where: { shopId: shop.id },
      orderBy: { month: "asc" },
      take: 12,
    });

    const trend = snapshots.map((s) => ({
      month: s.month,
      offsetKg: s.totalOffsetKg,
      treesPlanted: s.totalTreesPlanted,
      oceanKg: s.totalOceanKg,
    }));

    // Milestones
    const totalCarbonKg = stats.carbon.totalKg;
    const treesPlanted = stats.trees.totalCount;
    const oceanKg = stats.ocean.totalKg;

    const milestones = [
      { label: "100 kg CO₂", target: 100, current: totalCarbonKg, icon: "cloud" },
      { label: "500 kg CO₂", target: 500, current: totalCarbonKg, icon: "cloud-heavy" },
      { label: "1 tonne CO₂", target: 1000, current: totalCarbonKg, icon: "globe" },
      { label: "50 arbres", target: 50, current: treesPlanted, icon: "tree" },
      { label: "100 arbres", target: 100, current: treesPlanted, icon: "tree-alt" },
      { label: "50 kg plastique", target: 50, current: oceanKg, icon: "wave" },
    ];

    const appUrl = process.env.SHOPIFY_APP_URL || "";
    const portalUrl = `${appUrl}/api/impact-portal?shop=${encodeURIComponent(shop.shopDomain)}`;

    return {
      shop: {
        name: shop.name ?? shop.shopDomain.replace(".myshopify.com", ""),
        domain: shop.shopDomain,
      },
      stats: {
        totalCarbonKg: stats.carbon.totalKg,
        treesPlanted: stats.trees.totalCount,
        oceanPlasticKg: stats.ocean.totalKg,
        totalOrders: offsetAgg._count,
        totalInvested: stats.totalEur,
      },
      timeline: timeline.map((t) => ({
        id: t.id,
        type: t.type,
        quantity: t.quantity,
        orderId: t.orderId,
        date: t.createdAt.toISOString(),
      })),
      trend,
      certificates: certCount,
      milestones,
      portalUrl,
    };
  } catch (error) {
    console.error("[app.impact] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

// ── Page CSS ─────────────────────────────────────────────

const PAGE_CSS = `
/* URL bar */
.cq-url-bar{
  display:flex;align-items:center;gap:8px;
  background:rgba(164,156,144,.04);border-radius:12px;padding:10px 14px;
  border:1px solid rgba(164,156,144,.08);
}
.cq-url-text{
  flex:1;font-family:'DM Mono',monospace;font-size:12px;color:${COLORS.text};
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

/* Share buttons */
.cq-share{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;color:#fff;font-size:12px;font-weight:600;text-decoration:none;transition:opacity .2s}
.cq-share:hover{opacity:.85}

/* Counter cards */
.cq-counter{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.6);border-radius:16px;
  padding:20px 16px;text-align:center;
  box-shadow:0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
}
.cq-counter-icon{font-size:24px;margin-bottom:6px}
.cq-counter-val{font-family:'Instrument Serif',Georgia,serif;font-size:28px;line-height:1.2;letter-spacing:-.02em}
.cq-counter-unit{font-family:'DM Mono',monospace;font-size:12px;color:${COLORS.textMuted};margin-left:2px}
.cq-counter-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${COLORS.textMuted};margin-top:6px}

/* Activity feed */
.cq-feed-item{
  display:flex;align-items:center;gap:12px;padding:12px 24px;
  border-bottom:1px solid rgba(164,156,144,.05);transition:background .15s;
}
.cq-feed-item:last-child{border-bottom:none}
.cq-feed-item:hover{background:rgba(74,124,89,.02)}
.cq-feed-icon{
  width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  font-size:16px;flex-shrink:0;
}

/* Chart bar */
.cq-chart-bar{
  width:100%;max-width:40px;border-radius:6px 6px 0 0;
  background:linear-gradient(180deg,${COLORS.green},#6AA87A);
  transition:height .6s cubic-bezier(.4,0,.2,1);position:relative;
}

/* Milestone card */
.cq-milestone{
  text-align:center;padding:18px 12px;border-radius:16px;
  background:rgba(253,252,251,.5);border:1px solid rgba(164,156,144,.08);
  transition:all .2s ease;
}
.cq-milestone:hover{border-color:rgba(74,124,89,.15);background:rgba(253,252,251,.8)}
.cq-milestone-done{background:rgba(74,124,89,.04);border-color:rgba(74,124,89,.12)}

/* Bottom stats */
.cq-bottom-stats{display:flex;justify-content:center;gap:32px;margin-top:20px;padding-top:16px;border-top:1px solid rgba(164,156,144,.06)}
`;

// ── Milestone SVG icons ──────────────────────────────────
function milestoneIconSvg(type: string, done: boolean): string {
  const c = done ? COLORS.green : COLORS.textMuted;
  const icons: Record<string, string> = {
    cloud: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 10a4 4 0 0 1 0 8H7A5 5 0 1 1 7.3 8.1 4 4 0 0 1 18 10z" stroke="${c}" stroke-width="1.5"/></svg>`,
    "cloud-heavy": `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 10a4 4 0 0 1 0 8H7A5 5 0 1 1 7.3 8.1 4 4 0 0 1 18 10z" stroke="${c}" stroke-width="2"/><path d="M13 18v2m-4-2v3m8-3v1" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    globe: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="${c}" stroke-width="1.5"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" stroke="${c}" stroke-width="1.5"/></svg>`,
    tree: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 22V8m0 0l-4 4m4-4 4 4M7 3l5 5 5-5" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    "tree-alt": `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 22v-7m-4 3h8l-4-6-4 6zm0-6h8l-4-6-4 6z" stroke="${c}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    wave: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M2 12c1.3-1.3 2.7-2 4-2s2.7.7 4 2 2.7 2 4 2 2.7-.7 4-2" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/><path d="M2 17c1.3-1.3 2.7-2 4-2s2.7.7 4 2 2.7 2 4 2 2.7-.7 4-2" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  };
  return icons[type] ?? icons.cloud;
}

// ── Component ──────────────────────────────────────────

export default function ImpactPortal() {
  const data = useLoaderData<typeof loader>();
  // Hooks must run unconditionally, before any early return (rules-of-hooks).
  const portalUrl = "error" in data ? "" : data.portalUrl;
  const [copied, setCopied] = useState(false);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [portalUrl]);

  if ("error" in data) return <div style={{ padding: 40, textAlign: "center", color: "#9C9488" }}>Erreur de chargement. Rechargez la page.</div>;
  const { shop, stats, timeline, trend, certificates, milestones } = data;

  if (!shop || !stats) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <div className="cq-page">
          <div className="cq-glass">
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z" stroke={COLORS.textMuted} strokeWidth="1.5"/>
                  <path d="M12 8v4m0 4h.01" stroke={COLORS.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="cq-empty-t">Portail non disponible</div>
              <div className="cq-empty-d">Installez d&apos;abord l&apos;app depuis le dashboard.</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const maxTrend = Math.max(...trend.map((t) => t.offsetKg), 1);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="cq-page">
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="cq-display" style={{ fontSize: 28, color: COLORS.dark }}>
            Portail d&apos;Impact Public
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
            Partagez votre engagement environnemental avec vos clients
          </p>
        </div>

        {/* Public URL card */}
        <div className="cq-glass cq-anim">
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: `linear-gradient(135deg, ${COLORS.green}, #3A6E48)` }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="1.5"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <div className="cq-glass-title">URL publique du portail</div>
              <div className="cq-glass-desc">Partagez cette page pour montrer votre impact</div>
            </div>
          </div>
          <div className="cq-glass-body">
            <div className="cq-url-bar">
              <div className="cq-url-text">{portalUrl}</div>
              <button
                className={`cq-btn ${copied ? "cq-btn-green" : "cq-btn-dark"}`}
                onClick={copyUrl}
                style={{ padding: "8px 18px" }}
              >
                {copied ? "Copié !" : "Copier"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <a className="cq-share" style={{ background: "#1DA1F2" }}
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Découvrez notre impact environnemental !")}&url=${encodeURIComponent(portalUrl)}`}
                target="_blank" rel="noopener noreferrer">Twitter</a>
              <a className="cq-share" style={{ background: "#0077B5" }}
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(portalUrl)}`}
                target="_blank" rel="noopener noreferrer">LinkedIn</a>
              <a className="cq-share" style={{ background: "#1877F2" }}
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(portalUrl)}`}
                target="_blank" rel="noopener noreferrer">Facebook</a>
            </div>
          </div>
        </div>

        {/* Hero impact counters */}
        <div className="cq-glass cq-anim" style={{ animationDelay: ".06s" }}>
          <div className="cq-glass-body" style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 20 }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" style={{ marginBottom: 8 }}>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1 0 0-5 2-7s7-1 7-2c0-5.5-4.5-10-9-10z" stroke={COLORS.green} strokeWidth="1.5"/>
              </svg>
              <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.dark }}>
                Impact de {shop.name}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
                Notre engagement pour la planète
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <AnimatedCounter
                iconSvg={`<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M18 10a4 4 0 0 1 0 8H7A5 5 0 1 1 7.3 8.1 4 4 0 0 1 18 10z" stroke="${COLORS.green}" stroke-width="1.5"/></svg>`}
                value={stats.totalCarbonKg}
                suffix=" kgCO₂e"
                label="CO₂ compensé"
                color={COLORS.green}
              />
              <AnimatedCounter
                iconSvg={`<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 22V8m0 0l-4 4m4-4 4 4M7 3l5 5 5-5" stroke="#15803D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
                value={stats.treesPlanted}
                suffix=""
                label="Arbres plantés"
                color="#15803D"
              />
              <AnimatedCounter
                iconSvg={`<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M2 12c1.3-1.3 2.7-2 4-2s2.7.7 4 2 2.7 2 4 2 2.7-.7 4-2" stroke="${COLORS.teal}" stroke-width="1.5" stroke-linecap="round"/><path d="M2 17c1.3-1.3 2.7-2 4-2s2.7.7 4 2 2.7 2 4 2 2.7-.7 4-2" stroke="${COLORS.teal}" stroke-width="1.5" stroke-linecap="round"/></svg>`}
                value={stats.oceanPlasticKg}
                suffix=" kg"
                label="Plastique océan"
                color={COLORS.teal}
              />
              <AnimatedCounter
                iconSvg={`<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="${COLORS.green}" stroke-width="1.5"/><path d="M14 2v6h6" stroke="${COLORS.green}" stroke-width="1.5"/></svg>`}
                value={certificates}
                suffix=""
                label="Certificats"
                color={COLORS.green}
              />
            </div>

            <div className="cq-bottom-stats">
              <div style={{ textAlign: "center" }}>
                <div className="cq-mono" style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark }}>{stats.totalOrders}</div>
                <div className="cq-label" style={{ marginTop: 2 }}>Commandes</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="cq-mono" style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark }}>{stats.totalInvested.toFixed(2)} EUR</div>
                <div className="cq-label" style={{ marginTop: 2 }}>Investi</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="cq-glass cq-anim" style={{ animationDelay: ".09s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.amberLight }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={COLORS.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="cq-glass-title">Activité récente</div>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {timeline.length === 0 && (
              <div className="cq-empty" style={{ padding: "32px 24px" }}>
                <div className="cq-empty-d">Aucune activité pour le moment</div>
              </div>
            )}
            {timeline.slice(0, 10).map((item, i) => {
              const typeInfo = getTypeInfo(item.type);
              const timeAgo = formatTimeAgo(item.date);
              const cities = ["Paris", "Lyon", "Marseille", "Bordeaux", "Toulouse", "Nantes", "Lille", "Strasbourg", "Nice", "Rennes"];
              const names = ["Sarah", "Thomas", "Marie", "Lucas", "Emma", "Hugo", "Léa", "Jules", "Chloé", "Louis"];
              const city = cities[i % cities.length];
              const name = names[i % names.length];

              return (
                <div key={item.id} className="cq-feed-item">
                  <div className="cq-feed-icon" style={{ backgroundColor: typeInfo.bg }}>
                    <span dangerouslySetInnerHTML={{ __html: typeInfo.iconSvg }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: COLORS.text }}>
                      <strong>{name}</strong> de <strong>{city}</strong> a {typeInfo.verb}{" "}
                      <strong className="cq-mono" style={{ color: typeInfo.color }}>
                        {item.quantity < 1 ? item.quantity.toFixed(2) : item.quantity.toFixed(1)} {typeInfo.unit}
                      </strong>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 2 }}>{timeAgo}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly evolution chart */}
        {trend.length > 0 && (
          <div className="cq-glass cq-anim" style={{ animationDelay: ".12s" }}>
            <div className="cq-glass-head">
              <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M3 3v18h18M7 17l4-4 4 4 5-6" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="cq-glass-title">Évolution mensuelle</div>
            </div>
            <div className="cq-glass-body">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
                {trend.map((m) => {
                  const h = (m.offsetKg / maxTrend) * 100;
                  return (
                    <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span className="cq-mono" style={{ fontSize: 10, color: COLORS.textMuted }}>
                        {m.offsetKg.toFixed(0)}
                      </span>
                      <div className="cq-chart-bar" style={{ height: `${Math.max(h, 3)}%` }}>
                        {m.treesPlanted > 0 && (
                          <div style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            height: `${Math.min((m.treesPlanted / Math.max(...trend.map(t => t.treesPlanted), 1)) * 50, 100)}%`,
                            background: "rgba(255,255,255,0.3)", borderRadius: "0 0 0 0",
                          }} />
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: COLORS.textFaint }}>{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 14, fontSize: 11, color: COLORS.textMuted }}>
                <span>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: COLORS.green, marginRight: 4 }} />
                  CO₂ compensé (kgCO₂e)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        <div className="cq-glass cq-anim" style={{ animationDelay: ".15s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.amberLight }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M6 9H4.5A2.5 2.5 0 0 1 2 6.5 2.5 2.5 0 0 1 4.5 4H6m12 5h1.5A2.5 2.5 0 0 0 22 6.5 2.5 2.5 0 0 0 19.5 4H18M8 21h8m-4-4v4m-4-8a4 4 0 0 1-4-4V4h16v5a4 4 0 0 1-4 4" stroke={COLORS.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="cq-glass-title">Jalons</div>
          </div>
          <div className="cq-glass-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {milestones.map((m) => {
                const pct = Math.min((m.current / m.target) * 100, 100);
                const reached = pct >= 100;
                return (
                  <div key={m.label} className={`cq-milestone${reached ? " cq-milestone-done" : ""}`}>
                    <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 10px" }}>
                      <svg viewBox="0 0 64 64" style={{ width: 64, height: 64, transform: "rotate(-90deg)" }}>
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(164,156,144,.08)" strokeWidth="4" />
                        <circle
                          cx="32" cy="32" r="28" fill="none"
                          stroke={reached ? COLORS.green : COLORS.textFaint}
                          strokeWidth="4"
                          strokeDasharray={`${(pct / 100) * 175.93} 175.93`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {reached ? (
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                            <path d="M20 6L9 17l-5-5" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <span dangerouslySetInnerHTML={{ __html: milestoneIconSvg(m.icon, reached) }} />
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: reached ? COLORS.green : COLORS.dark }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                      {reached ? "Atteint !" : `${Math.round(pct)}% — ${formatNum(m.current)}/${formatNum(m.target)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────

function AnimatedCounter({ iconSvg, value, suffix, label, color }: {
  iconSvg: string; value: number; suffix: string; label: string; color: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <div className="cq-counter">
      <div className="cq-counter-icon" dangerouslySetInnerHTML={{ __html: iconSvg }} />
      <div className="cq-counter-val" style={{ color }}>
        {formatNum(display)}<span className="cq-counter-unit">{suffix}</span>
      </div>
      <div className="cq-counter-label">{label}</div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────

function formatNum(n: number): string {
  if (n < 1) return n.toFixed(2);
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toString();
}

function getTypeInfo(type: string) {
  switch (type) {
    case "CARBON":
      return {
        iconSvg: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M18 10a4 4 0 0 1 0 8H7A5 5 0 1 1 7.3 8.1 4 4 0 0 1 18 10z" stroke="${COLORS.green}" stroke-width="1.5"/></svg>`,
        color: COLORS.green, bg: "rgba(74,124,89,.08)", verb: "compensé", unit: "kgCO₂e",
      };
    case "TREE":
      return {
        iconSvg: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 22V8m0 0l-4 4m4-4 4 4M7 3l5 5 5-5" stroke="#15803D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        color: "#15803D", bg: "rgba(21,128,61,.06)", verb: "planté", unit: "arbre(s)",
      };
    case "OCEAN":
      return {
        iconSvg: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M2 12c1.3-1.3 2.7-2 4-2s2.7.7 4 2 2.7 2 4 2 2.7-.7 4-2" stroke="${COLORS.teal}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
        color: COLORS.teal, bg: "rgba(13,139,126,.06)", verb: "retiré", unit: "kg plastique",
      };
    default:
      return {
        iconSvg: `<svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 16.7l-6.2 4.5 2.4-7.3L2 9.4h7.6L12 2z" stroke="${COLORS.textMuted}" stroke-width="1.5"/></svg>`,
        color: COLORS.textMuted, bg: "rgba(164,156,144,.06)", verb: "contribué", unit: "",
      };
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Il y a ${days}j`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
