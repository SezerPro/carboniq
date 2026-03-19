import { useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import {
  generateReductionTips,
  getReductionTips,
  markTipApplied,
} from "../lib/reduction/engine.server";

// -- Loader --

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { tips: [], progress: null };

  let tips = await getReductionTips(shop.id);

  // Auto-generate tips if none exist
  if (tips.length === 0) {
    await generateReductionTips(shop.id);
    tips = await getReductionTips(shop.id);
  }

  const products = await db.product.findMany({ where: { shopId: shop.id } });
  const totalCarbonKg = products.reduce(
    (s, p) => s + (p.carbonScoreKg ?? 0),
    0,
  );
  const appliedTips = tips.filter((t) => t.isApplied);
  const estimatedSavingKg = tips.reduce((s, t) => s + t.potentialSaving, 0);
  const achievedSavingKg = appliedTips.reduce(
    (s, t) => s + t.potentialSaving,
    0,
  );
  const reductionScore = tips.length > 0
    ? Math.round((appliedTips.length / tips.length) * 100)
    : 0;

  return {
    tips: tips.map((t) => ({
      id: t.id,
      category: t.category,
      title: t.title,
      description: t.description,
      potentialSaving: t.potentialSaving,
      potentialSavingPct: t.potentialSavingPct,
      isApplied: t.isApplied,
      appliedAt: t.appliedAt?.toISOString() ?? null,
    })),
    progress: {
      totalCarbonKg: Math.round(totalCarbonKg * 100) / 100,
      totalTips: tips.length,
      appliedTips: appliedTips.length,
      estimatedSavingKg: Math.round(estimatedSavingKg * 100) / 100,
      achievedSavingKg: Math.round(achievedSavingKg * 100) / 100,
      reductionPct:
        totalCarbonKg > 0
          ? Math.round((achievedSavingKg / totalCarbonKg) * 100)
          : 0,
      reductionScore,
    },
  };
};

// -- Action --

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { error: "Shop not found" };

  if (intent === "regenerate") {
    await generateReductionTips(shop.id);
    return { success: true, message: "Tips régénérés" };
  }

  if (intent === "apply") {
    const tipId = formData.get("tipId") as string;
    if (!tipId) return { error: "tipId manquant" };
    await markTipApplied(tipId);
    return { success: true };
  }

  if (intent === "unapply") {
    const tipId = formData.get("tipId") as string;
    if (!tipId) return { error: "tipId manquant" };
    await db.reductionTip.update({
      where: { id: tipId },
      data: { isApplied: false, appliedAt: null },
    });
    return { success: true };
  }

  return { error: "Unknown intent" };
};

// -- Category icons --

const CATEGORY_ICONS: Record<string, string> = {
  emballage: "\u{1F4E6}",
  transport: "\u{1F30D}",
  "matériaux": "\u267B\uFE0F",
  poids: "\u2696\uFE0F",
  logistique: "\u{1F69B}",
  "économie_circulaire": "\u{1F504}",
  "saisonnalité": "\u{1F33F}",
};

// -- Component --

export default function Reduction() {
  const { tips, progress } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const isRegenerating =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "regenerate";

  const handleRegenerate = useCallback(() => {
    fetcher.submit({ intent: "regenerate" }, { method: "POST" });
  }, [fetcher]);

  const ringPct = progress ? Math.min(100, progress.reductionScore) : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (ringPct / 100) * circumference;

  const totalPotentialSaving = progress?.estimatedSavingKg ?? 0;
  const totalPotentialPct =
    progress && progress.totalCarbonKg > 0
      ? Math.round(
          (progress.estimatedSavingKg / progress.totalCarbonKg) * 100,
        )
      : 0;

  return (
    <s-page heading="Réduire l'empreinte" backAction={{ url: "/app" }}>
      <s-button
        slot="primary-action"
        onClick={handleRegenerate}
        {...(isRegenerating ? { loading: true } : {})}
      >
        Recalculer les suggestions
      </s-button>

      {/* Summary card */}
      <div
        style={{
          background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
          border: "1px solid #a7f3d0",
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#065f46",
                marginBottom: 4,
              }}
            >
              Potentiel de réduction estimé
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#047857" }}>
              -{totalPotentialSaving} kg CO2 ({totalPotentialPct}%)
            </div>
          </div>
          <div
            style={{
              background: "white",
              borderRadius: 12,
              padding: "12px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 2 }}>
              Engagements pris
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#16a34a" }}>
              {progress?.appliedTips ?? 0} / {progress?.totalTips ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Progress ring + stats */}
      {progress && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 24,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: 24,
            marginBottom: 20,
            alignItems: "center",
          }}
        >
          {/* Ring */}
          <div style={{ position: "relative", width: 128, height: 128 }}>
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="10"
              />
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke={
                  ringPct >= 75
                    ? "#16a34a"
                    : ringPct >= 50
                      ? "#65a30d"
                      : ringPct >= 25
                        ? "#d97706"
                        : "#e5e7eb"
                }
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 64 64)"
                style={{
                  transition:
                    "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}
              >
                {ringPct}
              </span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>/ 100</span>
            </div>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <StatBox
              label="Empreinte actuelle"
              value={`${progress.totalCarbonKg} kg`}
              color="#374151"
            />
            <StatBox
              label="Économie potentielle"
              value={`${progress.estimatedSavingKg} kg`}
              color="#d97706"
            />
            <StatBox
              label="Engagements pris"
              value={`${progress.achievedSavingKg} kg`}
              color="#16a34a"
            />
            <StatBox
              label="Réduction estimée"
              value={`${progress.reductionPct}%`}
              color="#6366f1"
            />
          </div>
        </div>
      )}

      {/* Tips list */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Recommandations
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {tips.length} suggestion{tips.length !== 1 ? "s" : ""}
          </span>
        </div>

        {tips.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>
              {"\u{1F50D}"}
            </div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              Aucune suggestion pour le moment. Ajoutez des produits et
              recalculez.
            </div>
          </div>
        ) : (
          <div>
            {tips.map((tip, i) => (
              <div
                key={tip.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 20px",
                  borderBottom:
                    i < tips.length - 1 ? "1px solid #f9fafb" : "none",
                  backgroundColor: tip.isApplied ? "#f0fdf4" : "transparent",
                  borderLeft: tip.isApplied
                    ? "3px solid #16a34a"
                    : "3px solid transparent",
                  transition: "background-color 0.2s ease",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    backgroundColor: tip.isApplied ? "#dcfce7" : "#f3f4f6",
                    flexShrink: 0,
                  }}
                >
                  {tip.isApplied
                    ? "\u2705"
                    : CATEGORY_ICONS[tip.category] ?? "\u{1F4A1}"}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {tip.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 6,
                        color: "#16a34a",
                        backgroundColor: "#dcfce7",
                      }}
                    >
                      -{tip.potentialSaving.toFixed(1)} kg CO2
                    </span>
                    {tip.potentialSavingPct != null && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 6,
                          color: "#d97706",
                          backgroundColor: "#fef3c7",
                        }}
                      >
                        -{tip.potentialSavingPct}%
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    {tip.description}
                  </div>
                  {tip.isApplied && tip.appliedAt && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#16a34a",
                        marginTop: 4,
                      }}
                    >
                      Engagement pris le{" "}
                      {new Date(tip.appliedAt).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>

                {/* Action button */}
                <fetcher.Form method="POST" style={{ flexShrink: 0 }}>
                  <input
                    type="hidden"
                    name="intent"
                    value={tip.isApplied ? "unapply" : "apply"}
                  />
                  <input type="hidden" name="tipId" value={tip.id} />
                  <button
                    type="submit"
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      border: "1px solid",
                      cursor: "pointer",
                      color: tip.isApplied ? "#dc2626" : "#16a34a",
                      backgroundColor: tip.isApplied ? "#fef2f2" : "#f0fdf4",
                      borderColor: tip.isApplied ? "#fecaca" : "#bbf7d0",
                    }}
                  >
                    {tip.isApplied ? "Retirer" : "M'engager"}
                  </button>
                </fetcher.Form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legal disclaimer */}
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12,
        padding: "14px 20px", marginTop: 20,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>
            Avertissement — Estimations non vérifiées
          </div>
          <div style={{ fontSize: 11, color: "#a16207", lineHeight: 1.5 }}>
            Les économies affichées sont des <strong>estimations basées sur des moyennes sectorielles ADEME</strong>.
            Elles ne constituent pas une mesure réelle de réduction. Les économies effectives dépendent
            de la mise en œuvre concrète par le marchand. Conformément à la directive EU 2024/825 (EmpCo),
            aucune claim environnementale ne doit être communiquée aux clients sans preuve vérifiable.
            Le bouton "M'engager" enregistre une intention, pas une action vérifiée.
          </div>
        </div>
      </div>

      {/* Motivational section */}
      {progress && (
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
            border: "1px solid #a7f3d0",
            borderRadius: 12,
            padding: 24,
            marginTop: 20,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#065f46",
              marginBottom: 8,
            }}
          >
            Score d'engagement : {progress.reductionScore}/100
          </div>
          <div
            style={{
              width: "100%",
              height: 12,
              backgroundColor: "#d1fae5",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress.reductionScore}%`,
                height: "100%",
                background: "linear-gradient(90deg, #22c55e, #16a34a)",
                borderRadius: 6,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div
            style={{ fontSize: 12, color: "#047857", marginTop: 8 }}
          >
            {progress.reductionScore >= 75
              ? "Excellent ! Vous êtes un leader de la réduction carbone."
              : progress.reductionScore >= 50
                ? "Bien joué ! Continuez à appliquer les recommandations."
                : progress.reductionScore >= 25
                  ? "Bon début ! Chaque action compte pour la planète."
                  : "Commencez par appliquer quelques recommandations simples."}
          </div>
        </div>
      )}
    </s-page>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
