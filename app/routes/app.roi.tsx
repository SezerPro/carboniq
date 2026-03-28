import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

// ── Component ──────────────────────────────────────────

export default function ROIDashboard() {
  const data = useLoaderData<typeof loader>();

  if (!data.hasData) {
    return (
      <s-page heading="ROI & Performance">
        <s-section>
          <s-paragraph>Installez d&#39;abord l&#39;app depuis le dashboard.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  const { offsetRevenue, totalCertificates, adoptionRate, estimatedAddedValue, revenueBreakdown, abTestInsights, productsWithBadge, productsWithoutBadge, recommendations } = data;

  const maxRevBar = Math.max(revenueBreakdown.offsetDirect, revenueBreakdown.conversionLift, 1);

  return (
    <s-page heading="ROI & Performance">
      {/* ── Hero metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard accent="#059669" label="Revenue offset" value={`${offsetRevenue.toFixed(2)} EUR`} sub="Revenu direct compensation" />
        <MetricCard accent="#6366f1" label="Certificats generes" value={totalCertificates.toString()} sub="Certificats envoyes" />
        <MetricCard accent="#0ea5e9" label="Taux d'adoption offset" value={`${adoptionRate.toFixed(1)}%`} sub="Commandes avec offset" />
        <MetricCard accent="#f59e0b" label="Valeur ajoutee estimee" value={`${estimatedAddedValue.toFixed(2)} EUR`} sub="Offset + lift conversion" />
      </div>

      {/* ── Revenue breakdown ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Decomposition du revenu</div>
        </div>
        <div style={{ padding: 20 }}>
          <RevenueBar
            label="Revenu offset direct"
            value={revenueBreakdown.offsetDirect}
            max={maxRevBar}
            color="#059669"
          />
          <RevenueBar
            label="Lift conversion estime"
            value={revenueBreakdown.conversionLift}
            max={maxRevBar}
            color="#6366f1"
          />
          <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#f9fafb", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Panier moyen offset</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
              {revenueBreakdown.avgOrderValueLift.toFixed(2)} EUR
            </span>
          </div>
        </div>
      </div>

      {/* ── Impact sur la conversion ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ height: 3, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Impact sur la conversion</div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, alignItems: "center" }}>
            {/* Before */}
            <div style={{
              padding: 20, borderRadius: 12, textAlign: "center",
              backgroundColor: "#f9fafb", border: "1px solid #e5e7eb",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Sans badge eco
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                {productsWithoutBadge}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>produits</div>
              <div style={{
                marginTop: 12, padding: "6px 12px", borderRadius: 6,
                backgroundColor: "#fee2e2", color: "#dc2626",
                fontSize: 12, fontWeight: 600, display: "inline-block",
              }}>
                Conversion standard
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: "center", fontSize: 20, color: "#d1d5db" }}>
              {"\u2192"}
            </div>

            {/* After */}
            <div style={{
              padding: 20, borderRadius: 12, textAlign: "center",
              backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Avec badge eco
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a", fontVariantNumeric: "tabular-nums" }}>
                {productsWithBadge}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>produits</div>
              <div style={{
                marginTop: 12, padding: "6px 12px", borderRadius: 6,
                backgroundColor: "#dcfce7", color: "#16a34a",
                fontSize: 12, fontWeight: 600, display: "inline-block",
              }}>
                +2-4% conversion
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── A/B Test insights ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Insights A/B Tests</div>
          <Link
            to="/app/abtest"
            style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", textDecoration: "none" }}
          >
            Voir tous les tests {"\u2192"}
          </Link>
        </div>
        <div style={{ padding: 20 }}>
          {abTestInsights.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>
                Aucun test A/B termine pour le moment
              </div>
              <Link
                to="/app/abtest"
                style={{
                  display: "inline-block", padding: "8px 20px",
                  borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: "white", textDecoration: "none",
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                }}
              >
                Lancer un test
              </Link>
            </div>
          ) : (
            <div>
              {abTestInsights.map((t) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: "1px solid #f9fafb",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 10,
                      fontWeight: 600, color: "#6366f1", backgroundColor: "#ede9fe",
                    }}>
                      {t.testType}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{t.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      A: {(t.convRateA * 100).toFixed(1)}% | B: {(t.convRateB * 100).toFixed(1)}%
                    </span>
                    <span style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                      color: t.uplift > 0 ? "#16a34a" : "#dc2626",
                      backgroundColor: t.uplift > 0 ? "#dcfce7" : "#fee2e2",
                    }}>
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
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, #f59e0b, #f97316)" }} />
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Pour augmenter votre ROI...</div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "14px 20px", borderBottom: i < recommendations.length - 1 ? "1px solid #f9fafb" : "none",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  backgroundColor: "#fef3c7", color: "#d97706",
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                    {rec.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    {rec.description}
                  </div>
                </div>
                <span style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  color: "#16a34a", backgroundColor: "#dcfce7",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {rec.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </s-page>
  );
}

// ── Sub-components ─────────────────────────────────────

function MetricCard({ accent, label, value, sub }: { accent: string; label: string; value: string; sub: string }) {
  return (
    <div style={{ ...card, padding: "20px 20px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: accent }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function RevenueBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
          {value.toFixed(2)} EUR
        </span>
      </div>
      <div style={{ width: "100%", height: 10, backgroundColor: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          backgroundColor: color, borderRadius: 5,
          transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          minWidth: value > 0 ? 4 : 0,
        }} />
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
