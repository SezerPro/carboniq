import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireFeature } from "../lib/plans/gates.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "roi");
  try {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
      include: {
        products: true,
        offsets: { where: { status: "COMPLETED" } },
        certificates: true,
        abTests: { where: { isActive: false, winnerVariant: { not: null } } },
      },
    });

    if (!shop) {
      return {
        hasData: false,
        offsetRevenue: 0,
        totalCertificates: 0,
        adoptionRate: 0,
        estimatedAddedValue: 0,
        revenueBreakdown: { offsetDirect: 0, conversionLift: 0, avgOrderValueLift: 0 },
        abTestInsights: [],
        productsWithBadge: 0,
        productsWithoutBadge: 0,
        recommendations: [],
      };
    }

  // Revenue from offsets
  const offsetRevenue = shop.offsets.reduce((sum, o) => sum + o.amountEur, 0);

  // Certificates count
  const totalCertificates = shop.certificates.length;

  // Adoption rate: offsets / unique orders estimate
  // We count unique orderIds from offsets vs total products as proxy
  const uniqueOrders = new Set(shop.offsets.map((o) => o.orderId)).size;
  // Estimate total orders: at least the number of unique offset orders, or products * 5 as rough proxy
  const estimatedTotalOrders = Math.max(uniqueOrders, shop.products.length * 5, 1);
  const adoptionRate = Math.min((uniqueOrders / estimatedTotalOrders) * 100, 100);

  // Products with badge (have carbon score) vs without
  const productsWithBadge = shop.products.filter((p) => p.carbonScoreKg != null).length;
  const productsWithoutBadge = shop.products.length - productsWithBadge;

  // Estimated conversion lift (conservative: 2-4% from sustainability badges)
  const conversionLiftPct = productsWithBadge > 0 ? 3.2 : 0;
  const avgOrderValue = uniqueOrders > 0 ? offsetRevenue / uniqueOrders : 25;
  const estimatedConversionLiftRevenue = estimatedTotalOrders * (conversionLiftPct / 100) * avgOrderValue;

  // Avg order value lift (offset adds to AOV)
  const avgOrderValueLift = uniqueOrders > 0 ? offsetRevenue / uniqueOrders : 0;

  // Total estimated added value
  const estimatedAddedValue = offsetRevenue + estimatedConversionLiftRevenue;

  // A/B test insights from completed tests
  const abTestInsights = shop.abTests.slice(0, 5).map((t) => {
    const convRateA = t.impressionsA > 0 ? t.conversionsA / t.impressionsA : 0;
    const convRateB = t.impressionsB > 0 ? t.conversionsB / t.impressionsB : 0;
    const winnerRate = t.winnerVariant === "A" ? convRateA : convRateB;
    const loserRate = t.winnerVariant === "A" ? convRateB : convRateA;
    const uplift = loserRate > 0 ? ((winnerRate - loserRate) / loserRate) * 100 : 0;

    return {
      id: t.id,
      name: t.name,
      testType: t.testType,
      winnerVariant: t.winnerVariant,
      convRateA,
      convRateB,
      uplift,
    };
  });

  // Recommendations
  const recommendations: Array<{ title: string; description: string; impact: string }> = [];

  if (productsWithBadge < shop.products.length * 0.8) {
    recommendations.push({
      title: "Scorer plus de produits",
      description: `Seulement ${productsWithBadge}/${shop.products.length} produits ont un score carbone. Les badges eco augmentent les conversions de 2-4%.`,
      impact: "+3% conversions",
    });
  }

  if (!shop.enableOffset) {
    recommendations.push({
      title: "Activer la compensation au checkout",
      description: "La compensation carbone au checkout genere un revenu additionnel de 0.50-2 EUR par commande.",
      impact: "+1.2 EUR / commande",
    });
  }

  if (abTestInsights.length === 0) {
    recommendations.push({
      title: "Lancer un A/B test",
      description: "Testez differents styles de badges ou messages pour optimiser vos conversions.",
      impact: "+5-15% uplift",
    });
  }

  if (totalCertificates === 0) {
    recommendations.push({
      title: "Activer les certificats",
      description: "Les certificats de compensation fidelisent les clients et augmentent le panier moyen.",
      impact: "+8% retention",
    });
  }

  if (!shop.enableTrees && !shop.enableOcean) {
    recommendations.push({
      title: "Activer le multi-impact",
      description: "Proposer des actions arbres et ocean en plus du carbone augmente le taux d'adoption de 40%.",
      impact: "+40% adoption",
    });
  }

  return {
    hasData: true,
    offsetRevenue: Math.round(offsetRevenue * 100) / 100,
    totalCertificates,
    adoptionRate: Math.round(adoptionRate * 10) / 10,
    estimatedAddedValue: Math.round(estimatedAddedValue * 100) / 100,
    revenueBreakdown: {
      offsetDirect: Math.round(offsetRevenue * 100) / 100,
      conversionLift: Math.round(estimatedConversionLiftRevenue * 100) / 100,
      avgOrderValueLift: Math.round(avgOrderValueLift * 100) / 100,
    },
    abTestInsights,
    productsWithBadge,
    productsWithoutBadge,
    recommendations,
  };
  } catch (error) {
    console.error("[app.roi] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

// ── Page CSS ──────────────────────────────────────────

const PAGE_CSS = `
.roi-bar-track{height:10px;border-radius:5px;overflow:hidden;background:rgba(164,156,144,.08)}
.roi-bar-fill{height:100%;border-radius:5px;transition:width .5s cubic-bezier(.4,0,.2,1)}
.roi-compare{display:grid;grid-template-columns:1fr 40px 1fr;gap:0;align-items:center}
.roi-compare-box{padding:20px;border-radius:14px;text-align:center}
.roi-compare-before{background:rgba(164,156,144,.06);border:1px solid rgba(164,156,144,.1)}
.roi-compare-after{background:rgba(74,124,89,.05);border:1px solid rgba(74,124,89,.15)}
.roi-aov{margin-top:16px;padding:12px 16px;background:rgba(164,156,144,.04);border-radius:12px;display:flex;justify-content:space-between;align-items:center}
.roi-test-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(164,156,144,.05)}
.roi-test-row:last-child{border-bottom:none}
.roi-rec-item{display:flex;align-items:flex-start;gap:14px;padding:14px 24px;border-bottom:1px solid rgba(164,156,144,.05)}
.roi-rec-item:last-child{border-bottom:none}
.roi-rec-num{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;background:rgba(217,119,6,.08);color:#D97706}
`;

// ── Component ──────────────────────────────────────────

export default function ROIDashboard() {
  const data = useLoaderData<typeof loader>();

  if (!data.hasData) {
    return (
      <div className="cq-page">
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <div className="cq-glass cq-anim">
          <div className="cq-empty">
            <div className="cq-empty-icon">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm3 3h8v2H8V8zm0 4h5v2H8v-2z" fill={COLORS.textMuted}/></svg>
            </div>
            <div className="cq-empty-t">Aucune donnee disponible</div>
            <div className="cq-empty-d">{"Installez d'abord l'app depuis le dashboard."}</div>
          </div>
        </div>
      </div>
    );
  }

  const { offsetRevenue, totalCertificates, adoptionRate, estimatedAddedValue, revenueBreakdown, abTestInsights, productsWithBadge, productsWithoutBadge, recommendations } = data;

  const maxRevBar = Math.max(revenueBreakdown.offsetDirect, revenueBreakdown.conversionLift, 1);

  return (
    <div className="cq-page">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      {/* ── Hero metrics ── */}
      <div className="cq-metrics cq-stagger">
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.green }} />
          <div className="cq-metric-label">Revenue offset</div>
          <div className="cq-metric-val"><span className="cq-mono">{offsetRevenue.toFixed(2)}</span> <span>EUR</span></div>
          <div className="cq-metric-sub">Revenu direct compensation</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.dark }} />
          <div className="cq-metric-label">Certificats generes</div>
          <div className="cq-metric-val cq-display">{totalCertificates}</div>
          <div className="cq-metric-sub">Certificats envoyes</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.blue }} />
          <div className="cq-metric-label">{"Taux d'adoption offset"}</div>
          <div className="cq-metric-val"><span className="cq-mono">{adoptionRate.toFixed(1)}</span><span>%</span></div>
          <div className="cq-metric-sub">Commandes avec offset</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.amber }} />
          <div className="cq-metric-label">Valeur ajoutee estimee</div>
          <div className="cq-metric-val"><span className="cq-mono">{estimatedAddedValue.toFixed(2)}</span> <span>EUR</span></div>
          <div className="cq-metric-sub">Offset + lift conversion</div>
        </div>
      </div>

      {/* ── Revenue breakdown ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".15s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2v20M17 7l-5-5-5 5M4 12h16" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="cq-glass-title">Decomposition du revenu</div>
          </div>
        </div>
        <div className="cq-glass-body">
          <RevenueBar label="Revenu offset direct" value={revenueBreakdown.offsetDirect} max={maxRevBar} color={COLORS.green} />
          <RevenueBar label="Lift conversion estime" value={revenueBreakdown.conversionLift} max={maxRevBar} color={COLORS.dark} />
          <div className="roi-aov">
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Panier moyen offset</span>
            <span className="cq-mono" style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark }}>
              {revenueBreakdown.avgOrderValueLift.toFixed(2)} EUR
            </span>
          </div>
        </div>
      </div>

      {/* ── Impact sur la conversion ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".2s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="cq-glass-title">Impact sur la conversion</div>
          </div>
        </div>
        <div className="cq-glass-body">
          <div className="roi-compare">
            <div className="roi-compare-box roi-compare-before">
              <div className="cq-label" style={{ marginBottom: 8 }}>Sans badge eco</div>
              <div className="cq-display" style={{ fontSize: 28, color: COLORS.textMuted }}>{productsWithoutBadge}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>produits</div>
              <span className="cq-pill cq-pill-red" style={{ marginTop: 12, display: "inline-flex" }}>Conversion standard</span>
            </div>
            <div style={{ textAlign: "center", fontSize: 20, color: COLORS.textFaint }}>&#8594;</div>
            <div className="roi-compare-box roi-compare-after">
              <div className="cq-label" style={{ marginBottom: 8, color: COLORS.green }}>Avec badge eco</div>
              <div className="cq-display" style={{ fontSize: 28, color: COLORS.green }}>{productsWithBadge}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>produits</div>
              <span className="cq-pill cq-pill-green" style={{ marginTop: 12, display: "inline-flex" }}>+2-4% conversion</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── A/B Test insights ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".25s" }}>
        <div className="cq-glass-head" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="cq-glass-icon" style={{ background: COLORS.blueLight }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" stroke={COLORS.blue} strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div className="cq-glass-title">Insights A/B Tests</div>
          </div>
          <Link to="/app/abtest" style={{ fontSize: 12, fontWeight: 600, color: COLORS.green, textDecoration: "none" }}>
            Voir tous les tests &#8594;
          </Link>
        </div>
        <div className="cq-glass-body">
          {abTestInsights.length === 0 ? (
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div className="cq-empty-t">Aucun test A/B termine</div>
              <div className="cq-empty-d">Lancez votre premier test pour optimiser vos conversions</div>
              <Link to="/app/abtest" className="cq-btn cq-btn-green" style={{ marginTop: 16 }}>
                Lancer un test
              </Link>
            </div>
          ) : (
            <div>
              {abTestInsights.map((t) => (
                <div key={t.id} className="roi-test-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="cq-pill cq-pill-blue">{t.testType}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{t.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="cq-mono" style={{ fontSize: 12, color: COLORS.textMuted }}>
                      A: {(t.convRateA * 100).toFixed(1)}% | B: {(t.convRateB * 100).toFixed(1)}%
                    </span>
                    <span className={`cq-pill ${t.uplift > 0 ? "cq-pill-green" : "cq-pill-red"}`}>
                      {t.uplift > 0 ? "+" : ""}{t.uplift.toFixed(1)}% uplift
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recommendations ── */}
      {recommendations.length > 0 && (
        <div className="cq-glass cq-anim" style={{ animationDelay: ".3s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.amberLight }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l.146.146A3 3 0 0118 21H6a3 3 0 01-2.682-4.658l.146-.146z" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div className="cq-glass-title">Pour augmenter votre ROI...</div>
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {recommendations.map((rec, i) => (
              <div key={i} className="roi-rec-item">
                <div className="roi-rec-num">{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, marginBottom: 2 }}>{rec.title}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{rec.description}</div>
                </div>
                <span className="cq-pill cq-pill-green" style={{ flexShrink: 0 }}>{rec.impact}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

function RevenueBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{label}</span>
        <span className="cq-mono" style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark }}>
          {value.toFixed(2)} EUR
        </span>
      </div>
      <div className="roi-bar-track">
        <div className="roi-bar-fill" style={{ width: `${pct}%`, backgroundColor: color, minWidth: value > 0 ? 4 : 0 }} />
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
