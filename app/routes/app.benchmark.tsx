import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireFeature } from "../lib/plans/gates.server";
import { getShopBenchmark } from "../lib/benchmark/benchmark.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "benchmark");
  try {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });
    if (!shop) return { benchmark: null };

    const benchmark = await getShopBenchmark(shop.id);
    return { benchmark };
  } catch (error) {
    console.error("[app.benchmark] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

// ── Constants ─────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  "textile.tshirt": "T-shirt / Haut",
  "textile.jeans": "Jeans / Pantalon",
  "textile.manteau": "Manteau / Veste",
  "textile.chaussures": "Chaussures",
  "electronics.smartphone": "Smartphone",
  "electronics.laptop": "Laptop / Tablette",
  "electronics.headphones": "Casque / Écouteurs",
  "food.beef": "Boeuf / Viande",
  "food.chocolate": "Chocolat",
  "food.coffee": "Café",
  "furniture.wood": "Meuble bois",
  "beauty.skincare": "Soin / Cosmétique",
  "sports.bike": "Vélo",
  "books.book": "Livre",
  "toys.plastic": "Jouet",
  "generic.default": "Générique",
};

// ── Page CSS ──────────────────────────────────────────

const PAGE_CSS = `
/* Gauge */
.cq-gauge{position:relative;width:200px;height:110px;margin:0 auto 16px}
.cq-gauge-arc{
  position:absolute;bottom:0;left:0;right:0;width:200px;height:100px;
  border-radius:100px 100px 0 0;overflow:hidden;
  background:conic-gradient(from 180deg at 50% 100%,rgba(74,124,89,.3) 0deg,rgba(217,119,6,.3) 90deg,rgba(185,28,28,.3) 180deg);
}
.cq-gauge-needle{
  position:absolute;bottom:0;left:50%;width:3px;height:80px;
  background:${COLORS.dark};border-radius:2px;
  transform-origin:bottom center;
  transition:transform 1s cubic-bezier(.4,0,.2,1);
}
.cq-gauge-dot{
  position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
  width:12px;height:12px;border-radius:50%;background:${COLORS.dark};
}
.cq-gauge-label{position:absolute;bottom:-4px;font-size:10px;font-weight:600}
.cq-gauge-label--good{left:0;color:#15803D}
.cq-gauge-label--bad{right:0;color:${COLORS.red}}

/* Comparison bars */
.cq-bar-track{width:100%;height:10px;background:rgba(164,156,144,.08);border-radius:5px;overflow:hidden}
.cq-bar-fill{height:100%;border-radius:5px;transition:width .5s ease}

/* Score circle big */
.cq-big-score{
  font-family:'Instrument Serif',Georgia,serif;font-size:48px;font-weight:400;
  line-height:1;letter-spacing:-.03em;
}

/* Comparison metric cards */
.cq-compare-card{
  padding:20px 24px;border-radius:16px;text-align:center;
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,.6);
  box-shadow:0 1px 3px rgba(44,40,37,.04);
}
.cq-compare-card--accent{border-color:rgba(74,124,89,.15);background:rgba(74,124,89,.04)}

/* Rec item */
.cq-rec-item{
  display:flex;align-items:center;gap:12px;padding:14px 24px;
  border-bottom:1px solid rgba(164,156,144,.05);
}
.cq-rec-item:last-child{border-bottom:none}
.cq-rec-icon{
  width:28px;height:28px;border-radius:10px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:rgba(185,28,28,.08);color:${COLORS.red};font-size:14px;font-weight:700;
}
`;

export default function BenchmarkPage() {
  const { benchmark } = useLoaderData<typeof loader>();

  if (!benchmark) {
    return (
      <div className="cq-page">
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <div className="cq-glass cq-anim">
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
            </div>
            <div>
              <div className="cq-glass-title">Benchmarking</div>
              <div className="cq-glass-desc">Installez d&apos;abord l&apos;app depuis le dashboard.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isGood = benchmark.percentile <= 50;
  const gaugeAngle = (benchmark.percentile / 100) * 180;

  // Recommendations based on gaps
  const recommendations: Array<{ cat: string; label: string; gap: number }> = [];
  for (const [cat, shopData] of Object.entries(benchmark.shopByCategory)) {
    const industryAvg = benchmark.industryAvg[cat];
    if (industryAvg && shopData.avg > industryAvg) {
      recommendations.push({
        cat,
        label: CATEGORY_LABELS[cat] ?? cat,
        gap: Math.round((shopData.avg - industryAvg) * 100) / 100,
      });
    }
  }
  recommendations.sort((a, b) => b.gap - a.gap);

  return (
    <div className="cq-page">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      {/* ── Page header ── */}
      <div className="cq-glass cq-anim">
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          </div>
          <div>
            <div className="cq-glass-title">Benchmarking</div>
            <div className="cq-glass-desc">Comparez votre empreinte carbone avec le secteur</div>
          </div>
        </div>
      </div>

      {/* ── Hero gauge ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".06s" }}>
        <div className="cq-glass-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 28, paddingBottom: 28 }}>
          {/* Gauge visual */}
          <div className="cq-gauge">
            <div className="cq-gauge-arc" />
            <div className="cq-gauge-needle" style={{ transform: `translateX(-50%) rotate(${gaugeAngle - 90}deg)` }} />
            <div className="cq-gauge-dot" />
            <div className="cq-gauge-label cq-gauge-label--good">Excellent</div>
            <div className="cq-gauge-label cq-gauge-label--bad">Élevé</div>
          </div>

          <div className="cq-label" style={{ color: isGood ? "#15803D" : COLORS.amber, fontSize: 14, marginBottom: 4 }}>
            Top {benchmark.percentile}%
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.dark, textAlign: "center" }}>
            Votre boutique est {isGood ? "plus vertueuse" : "au-dessus de la moyenne"}
          </div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4, textAlign: "center" }}>
            Meilleure que <strong style={{ color: COLORS.dark }}>{benchmark.betterThanPct}%</strong> des boutiques du réseau
          </div>
        </div>
      </div>

      {/* ── Avg comparison ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".09s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.blueLight, color: COLORS.blue }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <div className="cq-glass-title">Votre moyenne vs Moyenne globale</div>
        </div>
        <div className="cq-glass-body">
          <div className="cq-grid-2" style={{ marginBottom: 20 }}>
            <div className="cq-compare-card cq-compare-card--accent">
              <div className="cq-label" style={{ color: "#15803D", marginBottom: 6 }}>Votre boutique</div>
              <div className="cq-display" style={{ fontSize: 28, color: COLORS.dark }}>
                {benchmark.shopAvgCarbonKg.toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                <span className="cq-mono">kgCO₂e</span> / produit
              </div>
            </div>
            <div className="cq-compare-card">
              <div className="cq-label" style={{ marginBottom: 6 }}>Moyenne globale</div>
              <div className="cq-display" style={{ fontSize: 28, color: COLORS.dark }}>
                {benchmark.globalAvgCarbonKg.toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                <span className="cq-mono">kgCO₂e</span> / produit
              </div>
            </div>
          </div>

          {/* Visual comparison bar */}
          {(() => {
            const maxVal = Math.max(benchmark.shopAvgCarbonKg, benchmark.globalAvgCarbonKg, 1);
            const shopPct = (benchmark.shopAvgCarbonKg / maxVal) * 100;
            const globalPct = (benchmark.globalAvgCarbonKg / maxVal) * 100;
            const shopBetter = benchmark.shopAvgCarbonKg <= benchmark.globalAvgCarbonKg;
            return (
              <div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500 }}>Vous</span>
                    <span className="cq-mono" style={{ fontSize: 12, fontWeight: 600, color: shopBetter ? "#15803D" : COLORS.amber }}>
                      {benchmark.shopAvgCarbonKg.toFixed(1)} kgCO₂e
                    </span>
                  </div>
                  <div className="cq-bar-track">
                    <div className="cq-bar-fill" style={{ width: `${shopPct}%`, backgroundColor: shopBetter ? "#15803D" : COLORS.amber }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500 }}>Moyenne globale</span>
                    <span className="cq-mono" style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>
                      {benchmark.globalAvgCarbonKg.toFixed(1)} kgCO₂e
                    </span>
                  </div>
                  <div className="cq-bar-track">
                    <div className="cq-bar-fill" style={{ width: `${globalPct}%`, backgroundColor: COLORS.textMuted }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Category comparison table ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".12s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.purpleLight, color: COLORS.purple }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>
          <div className="cq-glass-title">Comparaison par catégorie</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {Object.keys(benchmark.shopByCategory).length === 0 ? (
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </div>
              <div className="cq-empty-t">Aucune donnée disponible</div>
              <div className="cq-empty-d">Calculez vos scores carbone pour voir le benchmark.</div>
            </div>
          ) : (
            <table className="cq-tbl">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th style={{ textAlign: "right" }}>Votre moy.</th>
                  <th style={{ textAlign: "right" }}>Moy. industrie</th>
                  <th style={{ textAlign: "center" }}>Delta</th>
                  <th style={{ textAlign: "right" }}>Produits</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(benchmark.shopByCategory).map(([cat, shopData]) => {
                  const industryAvg = benchmark.industryAvg[cat] ?? 0;
                  const delta = Math.round((shopData.avg - industryAvg) * 100) / 100;
                  const isBelow = delta <= 0;
                  return (
                    <tr key={cat}>
                      <td>
                        <span className="cq-pill cq-pill-gray">{CATEGORY_LABELS[cat] ?? cat}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="cq-mono" style={{ fontWeight: 600 }}>{shopData.avg.toFixed(1)} kgCO₂e</span>
                      </td>
                      <td style={{ textAlign: "right", color: COLORS.textMuted }}>
                        <span className="cq-mono">{industryAvg > 0 ? `${industryAvg.toFixed(1)} kgCO₂e` : "—"}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {industryAvg > 0 ? (
                          <span className={`cq-pill ${isBelow ? "cq-pill-green" : "cq-pill-red"}`}>
                            <span className="cq-mono">{delta > 0 ? "+" : ""}{delta.toFixed(1)} kgCO₂e</span>
                          </span>
                        ) : (
                          <span style={{ color: COLORS.textFaint }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", color: COLORS.textMuted }}>
                        <span className="cq-mono">{shopData.count}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── "Better than" visual ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".15s" }}>
        <div className="cq-glass-body" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
            Votre performance carbone
          </div>
          <div className="cq-big-score" style={{ color: isGood ? "#15803D" : COLORS.amber }}>
            {benchmark.betterThanPct}%
          </div>
          <div style={{ fontSize: 15, color: COLORS.text, marginTop: 8, fontWeight: 500 }}>
            des boutiques ont une empreinte carbone plus élevée que la vôtre
          </div>
          <div className="cq-bar-track" style={{ height: 8, marginTop: 16, borderRadius: 4 }}>
            <div className="cq-bar-fill" style={{
              width: `${benchmark.betterThanPct}%`,
              height: "100%",
              background: isGood
                ? `linear-gradient(90deg, ${COLORS.green}, #22c55e)`
                : `linear-gradient(90deg, ${COLORS.amber}, #f59e0b)`,
              borderRadius: 4,
              transition: "width .8s ease",
            }} />
          </div>
        </div>
      </div>

      {/* ── Recommendations ── */}
      {recommendations.length > 0 && (
        <div className="cq-glass cq-anim" style={{ animationDelay: ".18s" }}>
          <div className="cq-glass-head" style={{ background: "rgba(217,119,6,.04)" }}>
            <div className="cq-glass-icon" style={{ background: COLORS.amberLight, color: COLORS.amber }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <div className="cq-glass-title">Pistes d&apos;amélioration</div>
              <div className="cq-glass-desc">Catégories où votre empreinte dépasse la moyenne du secteur</div>
            </div>
          </div>
          <div>
            {recommendations.slice(0, 5).map((rec) => (
              <div key={rec.cat} className="cq-rec-item">
                <div className="cq-rec-icon">!</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{rec.label}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                    +<span className="cq-mono">{rec.gap} kgCO₂e</span> au-dessus de la moyenne du secteur. Envisagez des matériaux ou fournisseurs alternatifs.
                  </div>
                </div>
                <span className="cq-pill cq-pill-red">
                  <span className="cq-mono">+{rec.gap} kgCO₂e</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length === 0 && Object.keys(benchmark.shopByCategory).length > 0 && (
        <div className="cq-glass cq-anim" style={{ animationDelay: ".18s" }}>
          <div className="cq-glass-body" style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#15803D" }}>Excellent !</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
              Toutes vos catégories sont en dessous ou au niveau de la moyenne du secteur. Continuez ainsi !
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
