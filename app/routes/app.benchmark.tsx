import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { getShopBenchmark } from "../lib/benchmark/benchmark.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { benchmark: null };

  const benchmark = await getShopBenchmark(shop.id);
  return { benchmark };
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

const CATEGORY_LABELS: Record<string, string> = {
  "textile.tshirt": "T-shirt / Haut",
  "textile.jeans": "Jeans / Pantalon",
  "textile.manteau": "Manteau / Veste",
  "textile.chaussures": "Chaussures",
  "electronics.smartphone": "Smartphone",
  "electronics.laptop": "Laptop / Tablette",
  "electronics.headphones": "Casque / Ecouteurs",
  "food.beef": "Boeuf / Viande",
  "food.chocolate": "Chocolat",
  "food.coffee": "Cafe",
  "furniture.wood": "Meuble bois",
  "beauty.skincare": "Soin / Cosmetique",
  "sports.bike": "Velo",
  "books.book": "Livre",
  "toys.plastic": "Jouet",
  "generic.default": "Generique",
};

export default function BenchmarkPage() {
  const { benchmark } = useLoaderData<typeof loader>();

  if (!benchmark) {
    return (
      <s-page heading="Benchmarking">
        <s-section>
          <s-paragraph>
            Installez d&#39;abord l&#39;app depuis le dashboard.
          </s-paragraph>
        </s-section>
      </s-page>
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
    <s-page heading="Benchmarking">
      {/* ── Hero gauge ── */}
      <div
        style={{
          ...card,
          marginBottom: 20,
          background: isGood
            ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)"
            : "linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)",
          border: isGood ? "1px solid #bbf7d0" : "1px solid #fed7aa",
        }}
      >
        <div
          style={{
            padding: "28px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Gauge visual */}
          <div
            style={{
              position: "relative",
              width: 200,
              height: 110,
              marginBottom: 16,
            }}
          >
            {/* Background arc */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                width: 200,
                height: 100,
                borderRadius: "100px 100px 0 0",
                background:
                  "conic-gradient(from 180deg at 50% 100%, #dcfce7 0deg, #fef3c7 90deg, #fee2e2 180deg)",
                overflow: "hidden",
              }}
            />
            {/* Needle */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                width: 3,
                height: 80,
                backgroundColor: "#111827",
                borderRadius: 2,
                transformOrigin: "bottom center",
                transform: `translateX(-50%) rotate(${gaugeAngle - 90}deg)`,
                transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
            {/* Center dot */}
            <div
              style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: "#111827",
              }}
            />
            {/* Labels */}
            <div
              style={{
                position: "absolute",
                bottom: -4,
                left: 0,
                fontSize: 10,
                color: "#16a34a",
                fontWeight: 600,
              }}
            >
              Excellent
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -4,
                right: 0,
                fontSize: 10,
                color: "#dc2626",
                fontWeight: 600,
              }}
            >
              Eleve
            </div>
          </div>

          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: isGood ? "#16a34a" : "#d97706",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            Top {benchmark.percentile}%
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#111827",
              textAlign: "center",
            }}
          >
            Votre boutique est{" "}
            {isGood ? "plus vertueuse" : "au-dessus de la moyenne"}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            Meilleure que{" "}
            <strong style={{ color: "#111827" }}>
              {benchmark.betterThanPct}%
            </strong>{" "}
            des boutiques du reseau
          </div>
        </div>
      </div>

      {/* ── Avg comparison ── */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 16,
          }}
        >
          Votre moyenne vs Moyenne globale
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 10,
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#16a34a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              Votre boutique
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#111827",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {benchmark.shopAvgCarbonKg.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>kg CO2 / produit</div>
          </div>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 10,
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 4,
              }}
            >
              Moyenne globale
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#111827",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {benchmark.globalAvgCarbonKg.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>kg CO2 / produit</div>
          </div>
        </div>

        {/* Visual comparison bar */}
        {(() => {
          const maxVal = Math.max(
            benchmark.shopAvgCarbonKg,
            benchmark.globalAvgCarbonKg,
            1,
          );
          const shopPct = (benchmark.shopAvgCarbonKg / maxVal) * 100;
          const globalPct = (benchmark.globalAvgCarbonKg / maxVal) * 100;
          const shopBetter = benchmark.shopAvgCarbonKg <= benchmark.globalAvgCarbonKg;
          return (
            <div>
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                    Vous
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: shopBetter ? "#16a34a" : "#ea580c",
                    }}
                  >
                    {benchmark.shopAvgCarbonKg.toFixed(1)} kg
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 10,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${shopPct}%`,
                      height: "100%",
                      backgroundColor: shopBetter ? "#16a34a" : "#ea580c",
                      borderRadius: 5,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>
                    Moyenne globale
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#6b7280",
                    }}
                  >
                    {benchmark.globalAvgCarbonKg.toFixed(1)} kg
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 10,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 5,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${globalPct}%`,
                      height: "100%",
                      backgroundColor: "#9ca3af",
                      borderRadius: 5,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Category comparison table ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Comparaison par categorie
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {Object.keys(benchmark.shopByCategory).length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              Aucune donnee disponible. Calculez vos scores carbone pour voir le
              benchmark.
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <th
                    style={{
                      padding: "10px 20px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Categorie
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Votre moy.
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Moy. industrie
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Delta
                  </th>
                  <th
                    style={{
                      padding: "10px 20px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Produits
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(benchmark.shopByCategory).map(
                  ([cat, shopData]) => {
                    const industryAvg = benchmark.industryAvg[cat] ?? 0;
                    const delta =
                      Math.round((shopData.avg - industryAvg) * 100) / 100;
                    const isBelow = delta <= 0;
                    return (
                      <tr
                        key={cat}
                        style={{ borderBottom: "1px solid #f9fafb" }}
                      >
                        <td style={{ padding: "12px 20px", fontWeight: 500 }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              backgroundColor: "#f3f4f6",
                              color: "#374151",
                            }}
                          >
                            {CATEGORY_LABELS[cat] ?? cat}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {shopData.avg.toFixed(1)} kg
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            color: "#6b7280",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {industryAvg > 0 ? `${industryAvg.toFixed(1)} kg` : "—"}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            textAlign: "center",
                          }}
                        >
                          {industryAvg > 0 ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 600,
                                backgroundColor: isBelow
                                  ? "#dcfce7"
                                  : "#fee2e2",
                                color: isBelow ? "#16a34a" : "#dc2626",
                              }}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta.toFixed(1)} kg
                            </span>
                          ) : (
                            <span style={{ color: "#d1d5db" }}>—</span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "12px 20px",
                            textAlign: "right",
                            color: "#6b7280",
                          }}
                        >
                          {shopData.count}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── "Better than" visual ── */}
      <div
        style={{
          ...card,
          padding: 20,
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            marginBottom: 8,
          }}
        >
          Votre performance carbone
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: isGood ? "#16a34a" : "#d97706",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {benchmark.betterThanPct}%
          </span>
        </div>
        <div
          style={{
            fontSize: 15,
            color: "#374151",
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          des boutiques ont une empreinte carbone plus elevee que la votre
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            backgroundColor: "#f3f4f6",
            borderRadius: 4,
            overflow: "hidden",
            marginTop: 16,
          }}
        >
          <div
            style={{
              width: `${benchmark.betterThanPct}%`,
              height: "100%",
              background: isGood
                ? "linear-gradient(90deg, #16a34a, #22c55e)"
                : "linear-gradient(90deg, #d97706, #f59e0b)",
              borderRadius: 4,
              transition: "width 0.8s ease",
            }}
          />
        </div>
      </div>

      {/* ── Recommendations ── */}
      {recommendations.length > 0 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f3f4f6",
              background:
                "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            }}
          >
            <div
              style={{ fontSize: 14, fontWeight: 600, color: "#92400e" }}
            >
              Pistes d&#39;amelioration
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#a16207",
                marginTop: 2,
              }}
            >
              Categories ou votre empreinte depasse la moyenne du secteur
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {recommendations.slice(0, 5).map((rec, i) => (
              <div
                key={rec.cat}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom:
                    i < Math.min(recommendations.length, 5) - 1
                      ? "1px solid #f9fafb"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: "#fee2e2",
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  !
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {rec.label}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}
                  >
                    +{rec.gap} kg au-dessus de la moyenne du secteur.
                    Envisagez des materiaux ou fournisseurs alternatifs.
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#dc2626",
                    padding: "2px 10px",
                    borderRadius: 20,
                    backgroundColor: "#fee2e2",
                    flexShrink: 0,
                  }}
                >
                  +{rec.gap} kg
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length === 0 &&
        Object.keys(benchmark.shopByCategory).length > 0 && (
          <div
            style={{
              ...card,
              padding: 20,
              marginBottom: 20,
              background:
                "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
              border: "1px solid #bbf7d0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 22,
                marginBottom: 8,
              }}
            >
              *
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#16a34a",
              }}
            >
              Excellent !
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              Toutes vos categories sont en dessous ou au niveau de la
              moyenne du secteur. Continuez ainsi !
            </div>
          </div>
        )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
