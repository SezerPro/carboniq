import { useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { reports: [], shopName: session.shop };

  const reports = await db.rSEReport.findMany({
    where: { shopId: shop.id },
    orderBy: { generatedAt: "desc" },
  });

  return {
    shopName: shop.name ?? shop.shopDomain,
    reports: reports.map((r) => ({
      id: r.id,
      period: r.period,
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      dataJson: r.dataJson,
      generatedAt: r.generatedAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { error: "Shop not found" };

  if (intent === "generate-report") {
    const period = (formData.get("period") as string) || "MONTHLY";

    const now = new Date();
    let periodStart: Date;
    const periodEnd = now;

    if (period === "ANNUAL") {
      periodStart = new Date(now.getFullYear(), 0, 1);
    } else if (period === "QUARTERLY") {
      const quarter = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), quarter * 3, 1);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Gather data
    const products = await db.product.findMany({ where: { shopId: shop.id } });
    const totalCarbonKg = products.reduce((s, p) => s + (p.carbonScoreKg ?? 0), 0);
    const avgCarbonKg = products.length > 0 ? totalCarbonKg / products.length : 0;

    const dist = { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 };
    for (const p of products) {
      if (p.carbonLabel) dist[p.carbonLabel]++;
    }

    const offsets = await db.carbonOffset.aggregate({
      where: { shopId: shop.id, status: "COMPLETED", createdAt: { gte: periodStart, lte: periodEnd } },
      _sum: { carbonKg: true, amountEur: true },
      _count: true,
    });

    const impacts = await db.impactAction.findMany({
      where: { shopId: shop.id, createdAt: { gte: periodStart, lte: periodEnd } },
    });

    const treesPlanted = impacts.filter((i) => i.type === "TREE").reduce((s, i) => s + i.quantity, 0);
    const oceanKg = impacts.filter((i) => i.type === "OCEAN").reduce((s, i) => s + i.quantity, 0);

    const tips = await db.reductionTip.findMany({ where: { shopId: shop.id } });

    const topProducts = [...products]
      .sort((a, b) => (b.carbonScoreKg ?? 0) - (a.carbonScoreKg ?? 0))
      .slice(0, 10)
      .map((p) => ({ title: p.title, carbonScoreKg: p.carbonScoreKg, carbonLabel: p.carbonLabel }));

    const totalOffsetKg = offsets._sum.carbonKg ?? 0;

    const dataJson = JSON.stringify({
      shop: { domain: shop.shopDomain, name: shop.name },
      period: { type: period, start: periodStart.toISOString(), end: periodEnd.toISOString() },
      summary: {
        totalProducts: products.length,
        totalCarbonKg: Math.round(totalCarbonKg * 100) / 100,
        avgCarbonKg: Math.round(avgCarbonKg * 100) / 100,
        totalOffsetKg: Math.round(totalOffsetKg * 100) / 100,
        netCarbonKg: Math.round((totalCarbonKg - totalOffsetKg) * 100) / 100,
        offsetPercentage: totalCarbonKg > 0 ? Math.round((totalOffsetKg / totalCarbonKg) * 100) : 0,
        treesPlanted,
        oceanPlasticKg: oceanKg,
      },
      distribution: dist,
      topImpactProducts: topProducts,
      reductionTips: {
        total: tips.length,
        applied: tips.filter((t) => t.isApplied).length,
        estimatedSavings: tips.reduce((s, t) => s + t.potentialSaving, 0),
      },
      methodology: "ADEME Base Carbone + GHG Protocol",
      generatedAt: new Date().toISOString(),
    });

    const report = await db.rSEReport.create({
      data: {
        shopId: shop.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      period: period as any,
        periodStart,
        periodEnd,
        dataJson,
      },
    });

    return { success: true, reportId: report.id };
  }

  return { error: "Unknown intent" };
};

const PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Mensuel",
  QUARTERLY: "Trimestriel",
  ANNUAL: "Annuel",
};

export default function Reports() {
  const { reports, shopName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isGenerating = fetcher.state !== "idle";

  const handleGenerate = useCallback((period: string) => {
    fetcher.submit({ intent: "generate-report", period }, { method: "POST" });
  }, [fetcher]);

  return (
    <s-page heading="Rapports RSE">

      {/* Generate buttons */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
        marginBottom: 24,
      }}>
        {(["MONTHLY", "QUARTERLY", "ANNUAL"] as const).map((period) => (
          <button
            key={period}
            onClick={() => handleGenerate(period)}
            disabled={isGenerating}
            style={{
              background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
              padding: "20px", cursor: isGenerating ? "wait" : "pointer",
              textAlign: "center", transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>
              {period === "MONTHLY" ? "📅" : period === "QUARTERLY" ? "📊" : "📈"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              Rapport {PERIOD_LABELS[period]}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {period === "MONTHLY" ? "Ce mois" : period === "QUARTERLY" ? "Ce trimestre" : "Cette année"}
            </div>
          </button>
        ))}
      </div>

      {/* Info banner */}
      <div style={{
        background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
        border: "1px solid #ddd6fe", borderRadius: 12,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 24 }}>📋</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#5b21b6", marginBottom: 4 }}>
              Compatible CSRD
            </div>
            <div style={{ fontSize: 13, color: "#7c3aed", lineHeight: 1.5 }}>
              Vos rapports RSE sont structurés selon la directive européenne CSRD
              (Corporate Sustainability Reporting Directive). Utilisez-les pour vos
              obligations de reporting ou votre communication RSE.
            </div>
          </div>
        </div>
      </div>

      {/* Reports list */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Rapports générés</span>
        </div>

        {reports.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              Aucun rapport généré. Choisissez une période ci-dessus.
            </div>
          </div>
        ) : (
          <div>
            {reports.map((report, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let data: any = {};
              try { data = JSON.parse(report.dataJson); } catch { /* ignore parse errors */ }
              const summary = data.summary ?? {};

              return (
                <div key={report.id} style={{
                  padding: "16px 20px",
                  borderBottom: i < reports.length - 1 ? "1px solid #f9fafb" : "none",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f9fafb"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                          color: "#6366f1", backgroundColor: "#eef2ff",
                        }}>
                          {PERIOD_LABELS[report.period] ?? report.period}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {shopName}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        {new Date(report.periodStart).toLocaleDateString("fr-FR")} — {new Date(report.periodEnd).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        Généré le {new Date(report.generatedAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>

                  {/* Mini stats */}
                  <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                    <MiniStat label="Empreinte" value={`${summary.totalCarbonKg ?? 0} kg`} color="#374151" />
                    <MiniStat label="Compensé" value={`${summary.totalOffsetKg ?? 0} kg`} color="#16a34a" />
                    <MiniStat label="Net" value={`${summary.netCarbonKg ?? 0} kg`} color={summary.netCarbonKg <= 0 ? "#16a34a" : "#ea580c"} />
                    <MiniStat label="Arbres" value={`${summary.treesPlanted ?? 0}`} color="#16a34a" />
                    <MiniStat label="Produits" value={`${summary.totalProducts ?? 0}`} color="#6b7280" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </s-page>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
