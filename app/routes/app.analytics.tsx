import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

const cardHeader = (accent: string) => ({
  padding: "16px 20px",
  borderBottom: "1px solid #f3f4f6",
  display: "flex" as const,
  alignItems: "center" as const,
  gap: 10,
  position: "relative" as const,
  overflow: "hidden" as const,
});

const LABEL_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  LOW: { color: "#16a34a", bg: "#dcfce7", border: "#bbf7d0" },
  MEDIUM: { color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  HIGH: { color: "#ea580c", bg: "#ffedd5", border: "#fed7aa" },
  VERY_HIGH: { color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
};

const LABEL_TEXT: Record<string, string> = {
  LOW: "Faible", MEDIUM: "Modéré", HIGH: "Élevé", VERY_HIGH: "Très élevé",
};

export default function Analytics() {
  const { analytics, comparisons, trend } = useLoaderData<typeof loader>();

  if (!analytics) {
    return (
      <s-page heading="Analytiques" backAction={{ url: "/app" }}>
        <s-section>
          <s-paragraph>Installez d'abord l'app depuis le dashboard.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  const netCarbon = analytics.totalCarbonKg - analytics.offsetStats.totalOffsetKg;
  const offsetPct = analytics.totalCarbonKg > 0
    ? Math.round((analytics.offsetStats.totalOffsetKg / analytics.totalCarbonKg) * 100)
    : 0;

  return (
    <s-page heading="Analytiques" backAction={{ url: "/app" }}>
      {/* ── Hero metrics ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <MetricCard accent="#059669" label="Empreinte totale" value={`${analytics.totalCarbonKg.toFixed(1)} kg`} sub="CO₂ tous produits" />
        <MetricCard accent="#0ea5e9" label="Score moyen" value={`${analytics.avgCarbonKg.toFixed(1)} kg`} sub="CO₂ par produit" />
        <MetricCard accent="#8b5cf6" label="Compensé" value={`${analytics.offsetStats.totalOffsetKg.toFixed(1)} kg`} sub={`${offsetPct}% de l'empreinte`} />
        <MetricCard accent={netCarbon > 0 ? "#ea580c" : "#16a34a"} label="Empreinte nette" value={`${netCarbon.toFixed(1)} kg`} sub={netCarbon <= 0 ? "Neutre carbone !" : "Restant à compenser"} />
      </div>

      {/* ── Equivalences ── */}
      {comparisons && (
        <div style={{ ...card, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 14 }}>
            Votre empreinte équivaut à...
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <ComparisonChip icon="🚗" value={comparisons.carKm} unit="km en voiture" />
            <ComparisonChip icon="✈️" value={comparisons.flights} unit="vols Paris-Londres" />
            <ComparisonChip icon="📺" value={comparisons.netflixHours} unit="heures de Netflix" />
            <ComparisonChip icon="📱" value={comparisons.smartphones} unit="smartphones fabriqués" />
            <ComparisonChip icon="👕" value={comparisons.tshirts} unit="t-shirts produits" />
            <ComparisonChip icon="🥩" value={comparisons.beefKg} unit="kg de boeuf" />
          </div>
        </div>
      )}

      {/* ── Distribution chart (visual bars) ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Répartition des produits</div>
        </div>
        <div style={{ padding: 20 }}>
          {(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const).map((label) => {
            const count = analytics.distribution[label];
            const pct = analytics.totalProducts > 0 ? (count / analytics.totalProducts) * 100 : 0;
            const cfg = LABEL_COLORS[label];
            return (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{LABEL_TEXT[label]}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{count} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{ width: "100%", height: 10, backgroundColor: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    backgroundColor: cfg.color, borderRadius: 5,
                    transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                    minWidth: count > 0 ? 4 : 0,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Category breakdown ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Impact par catégorie</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Catégorie</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>CO₂ total</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Produits</th>
                <th style={{ padding: "10px 20px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Part</th>
              </tr>
            </thead>
            <tbody>
              {analytics.categoryBreakdown.map((cat) => {
                const pct = analytics.totalCarbonKg > 0 ? (cat.totalKg / analytics.totalCarbonKg) * 100 : 0;
                return (
                  <tr key={cat.code} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "12px 20px", fontWeight: 500 }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px",
                        borderRadius: 6, fontSize: 12, backgroundColor: "#f3f4f6",
                        color: "#374151",
                      }}>{cat.code}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {cat.totalKg.toFixed(1)} kg
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>{cat.count}</td>
                    <td style={{ padding: "12px 20px", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <div style={{ width: 48, height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#6366f1", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Top polluters & cleanest side by side ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <ProductRanking title="Top impact" icon="🔥" products={analytics.topPolluters} />
        <ProductRanking title="Plus vertueux" icon="🌱" products={analytics.topClean} />
      </div>

      {/* ── Monthly trend ── */}
      {trend.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Évolution mensuelle</div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
              {trend.map((m) => {
                const maxKg = Math.max(...trend.map((t) => t.totalCarbonKg), 1);
                const h = (m.totalCarbonKg / maxKg) * 100;
                return (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10, color: "#6b7280" }}>{m.totalCarbonKg.toFixed(0)}</span>
                    <div style={{
                      width: "100%", maxWidth: 40, height: `${h}%`, minHeight: 4,
                      background: "linear-gradient(180deg, #6366f1, #818cf8)",
                      borderRadius: "4px 4px 0 0",
                    }} />
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{m.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
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

function ComparisonChip({ icon, value, unit }: { icon: string; value: string; unit: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      backgroundColor: "#f9fafb", border: "1px solid #f3f4f6",
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{value}</div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{unit}</div>
      </div>
    </div>
  );
}

function ProductRanking({ title, icon, products }: {
  title: string; icon: string;
  products: Array<{ id: string; title: string; carbonScoreKg: number | null; carbonLabel: string | null }>;
}) {
  return (
    <div style={card}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{title}</span>
      </div>
      <div style={{ padding: "4px 0" }}>
        {products.slice(0, 5).map((p, i) => {
          const cfg = p.carbonLabel ? LABEL_COLORS[p.carbonLabel] : null;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 20px", borderBottom: i < 4 ? "1px solid #fafafa" : "none",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                backgroundColor: "#f3f4f6", color: "#6b7280",
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.title}
              </span>
              {cfg && (
                <span style={{
                  fontSize: 12, fontWeight: 600, color: cfg.color,
                  padding: "2px 8px", borderRadius: 6,
                  backgroundColor: cfg.bg,
                }}>
                  {p.carbonScoreKg != null ? `${p.carbonScoreKg < 1 ? p.carbonScoreKg.toFixed(2) : p.carbonScoreKg.toFixed(1)} kg` : "—"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
