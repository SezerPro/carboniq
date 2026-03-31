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
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

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

const PERIOD_SVGS: Record<string, string> = {
  MONTHLY: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="${COLORS.green}" stroke-width="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  QUARTERLY: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M3 3v18h18M7 17V13m4 4V9m4 8V5m4 12v-6" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ANNUAL: `<svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M3 3v18h18M7 17l4-4 4 4 5-6" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const PAGE_CSS = `
/* Period cards */
.cq-period-card{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.6);border-radius:18px;
  padding:24px;text-align:center;cursor:pointer;
  box-shadow:0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
  transition:all .25s cubic-bezier(.22,1,.36,1);
}
.cq-period-card:hover{
  border-color:rgba(74,124,89,.2);transform:translateY(-2px);
  box-shadow:0 2px 6px rgba(44,40,37,.06),0 8px 24px rgba(44,40,37,.08);
}
.cq-period-card:disabled{opacity:.5;cursor:wait;transform:none!important}
.cq-period-card-icon{margin-bottom:10px}

/* Report row */
.cq-report-row{
  padding:18px 24px;border-bottom:1px solid rgba(164,156,144,.05);
  transition:background .15s ease;
}
.cq-report-row:last-child{border-bottom:none}
.cq-report-row:hover{background:rgba(74,124,89,.02)}

/* Mini stats */
.cq-mini-stats{display:flex;gap:20px;margin-top:12px;flex-wrap:wrap}
.cq-mini-stat-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${COLORS.textMuted}}
.cq-mini-stat-val{font-family:'DM Mono',monospace;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px}
`;

export default function Reports() {
  const { reports, shopName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isGenerating = fetcher.state !== "idle";

  const handleGenerate = useCallback((period: string) => {
    fetcher.submit({ intent: "generate-report", period }, { method: "POST" });
  }, [fetcher]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="cq-page">
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="cq-display" style={{ fontSize: 28, color: COLORS.dark }}>
            Rapports RSE
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
            Générez des rapports de durabilité conformes aux standards européens
          </p>
        </div>

        {/* Generate period cards */}
        <div className="cq-grid-3 cq-stagger cq-anim" style={{ marginBottom: 20 }}>
          {(["MONTHLY", "QUARTERLY", "ANNUAL"] as const).map((period) => (
            <button
              key={period}
              className="cq-period-card cq-anim"
              onClick={() => handleGenerate(period)}
              disabled={isGenerating}
            >
              <div className="cq-period-card-icon" dangerouslySetInnerHTML={{ __html: PERIOD_SVGS[period] }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark }}>
                Rapport {PERIOD_LABELS[period]}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                {period === "MONTHLY" ? "Ce mois" : period === "QUARTERLY" ? "Ce trimestre" : "Cette année"}
              </div>
            </button>
          ))}
        </div>

        {/* CSRD info banner */}
        <div className="cq-info cq-anim" style={{ animationDelay: ".06s" }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke={COLORS.green} strokeWidth="1.5"/>
            <rect x="9" y="3" width="6" height="4" rx="1" stroke={COLORS.green} strokeWidth="1.5"/>
            <path d="M9 14l2 2 4-4" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="cq-info-text">
            <strong>Compatible CSRD</strong> — Vos rapports RSE sont structurés selon la directive européenne CSRD
            (Corporate Sustainability Reporting Directive). Utilisez-les pour vos
            obligations de reporting ou votre communication RSE.
          </div>
        </div>

        {/* Reports list */}
        <div className="cq-glass cq-anim" style={{ animationDelay: ".09s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={COLORS.green} strokeWidth="1.5"/>
                <path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="cq-glass-title">Rapports générés</div>
          </div>

          {reports.length === 0 ? (
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={COLORS.textMuted} strokeWidth="1.5"/>
                  <path d="M14 2v6h6" stroke={COLORS.textMuted} strokeWidth="1.5"/>
                </svg>
              </div>
              <div className="cq-empty-t">Aucun rapport généré</div>
              <div className="cq-empty-d">
                Choisissez une période ci-dessus pour générer votre premier rapport RSE.
              </div>
            </div>
          ) : (
            <div>
              {reports.map((report) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let data: any = {};
                try { data = JSON.parse(report.dataJson); } catch { /* ignore parse errors */ }
                const summary = data.summary ?? {};

                return (
                  <div key={report.id} className="cq-report-row">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span className="cq-pill cq-pill-green">
                            {PERIOD_LABELS[report.period] ?? report.period}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark }}>
                            {shopName}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                          {new Date(report.periodStart).toLocaleDateString("fr-FR")} — {new Date(report.periodEnd).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: COLORS.textFaint }}>
                          Généré le {new Date(report.generatedAt).toLocaleDateString("fr-FR")}
                        </div>
                      </div>
                    </div>

                    <div className="cq-mini-stats">
                      <div>
                        <div className="cq-mini-stat-label">Empreinte</div>
                        <div className="cq-mini-stat-val" style={{ color: COLORS.dark }}>
                          {summary.totalCarbonKg ?? 0} <span style={{ fontSize: 10, color: COLORS.textMuted }}>kgCO₂e</span>
                        </div>
                      </div>
                      <div>
                        <div className="cq-mini-stat-label">Compensé</div>
                        <div className="cq-mini-stat-val" style={{ color: COLORS.green }}>
                          {summary.totalOffsetKg ?? 0} <span style={{ fontSize: 10, color: COLORS.textMuted }}>kgCO₂e</span>
                        </div>
                      </div>
                      <div>
                        <div className="cq-mini-stat-label">Net</div>
                        <div className="cq-mini-stat-val" style={{ color: (summary.netCarbonKg ?? 0) <= 0 ? COLORS.green : COLORS.red }}>
                          {summary.netCarbonKg ?? 0} <span style={{ fontSize: 10, color: COLORS.textMuted }}>kgCO₂e</span>
                        </div>
                      </div>
                      <div>
                        <div className="cq-mini-stat-label">Arbres</div>
                        <div className="cq-mini-stat-val" style={{ color: COLORS.green }}>
                          {summary.treesPlanted ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="cq-mini-stat-label">Produits</div>
                        <div className="cq-mini-stat-val" style={{ color: COLORS.textMuted }}>
                          {summary.totalProducts ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
