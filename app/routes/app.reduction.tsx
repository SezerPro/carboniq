import { useCallback, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireFeature } from "../lib/plans/gates.server";
import {
  generateReductionTips,
  getReductionTips,
  markTipApplied,
} from "../lib/reduction/engine.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

// -- Loader --

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "reduction_basic");
  try {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });
    if (!shop) return { tips: [], progress: null, goal: null };

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

  // Fetch the latest reduction goal
  const latestGoal = await db.reductionGoal.findFirst({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });

  let goalData: {
    id: string;
    targetPct: number;
    baselineCo2Kg: number;
    currentCo2Kg: number;
    actualReductionPct: number;
    deadline: string;
    daysRemaining: number;
    progressPct: number;
    status: "on_track" | "behind" | "at_risk";
  } | null = null;

  if (latestGoal) {
    const currentCo2Kg = Math.round(totalCarbonKg * 100) / 100;
    const actualReductionPct =
      latestGoal.baselineCo2Kg > 0
        ? Math.round(
            ((latestGoal.baselineCo2Kg - currentCo2Kg) /
              latestGoal.baselineCo2Kg) *
              10000,
          ) / 100
        : 0;
    const progressPct =
      latestGoal.targetPct > 0
        ? Math.min(
            100,
            Math.round((actualReductionPct / latestGoal.targetPct) * 100),
          )
        : 0;

    const now = new Date();
    const deadline = new Date(latestGoal.deadline);
    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    // Determine status based on expected pace
    const totalDays = Math.ceil(
      (deadline.getTime() - latestGoal.createdAt.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const elapsedDays = totalDays - daysRemaining;
    const expectedProgressPct =
      totalDays > 0 ? (elapsedDays / totalDays) * 100 : 100;

    let status: "on_track" | "behind" | "at_risk" = "on_track";
    if (daysRemaining === 0 && progressPct < 100) {
      status = "at_risk";
    } else if (progressPct < expectedProgressPct * 0.5) {
      status = "at_risk";
    } else if (progressPct < expectedProgressPct * 0.8) {
      status = "behind";
    }

    goalData = {
      id: latestGoal.id,
      targetPct: latestGoal.targetPct,
      baselineCo2Kg: Math.round(latestGoal.baselineCo2Kg * 100) / 100,
      currentCo2Kg,
      actualReductionPct,
      deadline: latestGoal.deadline.toISOString(),
      daysRemaining,
      progressPct,
      status,
    };
  }

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
    goal: goalData,
  };
  } catch (error) {
    console.error("[app.reduction] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

// -- Action --

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "reduction_basic");
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

  if (intent === "set-goal") {
    const targetPct = parseFloat(formData.get("targetPct") as string);
    const deadlineStr = formData.get("deadline") as string;
    if (!targetPct || !deadlineStr) return { error: "Données manquantes" };

    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime()) || deadline <= new Date()) {
      return { error: "Date limite invalide" };
    }

    // Calculate current total CO2 as baseline
    const products = await db.product.findMany({
      where: { shopId: shop.id },
    });
    const baselineCo2Kg = products.reduce(
      (s, p) => s + (p.carbonScoreKg ?? 0),
      0,
    );

    // Delete any existing goals for this shop
    await db.reductionGoal.deleteMany({ where: { shopId: shop.id } });

    // Create new goal
    await db.reductionGoal.create({
      data: {
        shopId: shop.id,
        targetPct,
        baselineCo2Kg: Math.round(baselineCo2Kg * 100) / 100,
        deadline,
      },
    });

    return { success: true, message: "Objectif défini" };
  }

  if (intent === "delete-goal") {
    const goalId = formData.get("goalId") as string;
    if (!goalId) return { error: "goalId manquant" };
    await db.reductionGoal.delete({ where: { id: goalId } });
    return { success: true, message: "Objectif supprimé" };
  }

  return { error: "Unknown intent" };
};

// -- Page CSS --

const PAGE_CSS = `
/* Ring */
.cq-ring-wrap{position:relative;width:128px;height:128px;flex-shrink:0}
.cq-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cq-ring-val{font-family:'Instrument Serif',Georgia,serif;font-size:32px;color:${COLORS.dark};line-height:1}
.cq-ring-sub{font-size:11px;color:${COLORS.textMuted}}

/* Summary hero */
.cq-red-hero{
  background:rgba(74,124,89,.06);border:1px solid rgba(74,124,89,.12);
  border-radius:20px;padding:24px;margin-bottom:16px;
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;
}
.cq-red-hero-label{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${COLORS.green}}
.cq-red-hero-val{font-family:'Instrument Serif',Georgia,serif;font-size:32px;color:${COLORS.dark};line-height:1.1;margin-top:6px}
.cq-red-hero-val .unit{font-family:'DM Mono',monospace;font-size:14px;color:${COLORS.textMuted};margin-left:4px}
.cq-red-hero-badge{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,.6);border-radius:14px;
  padding:12px 20px;text-align:center;
}

/* Stats grid */
.cq-red-stats{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cq-red-stat-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${COLORS.textMuted}}
.cq-red-stat-val{font-family:'DM Mono',monospace;font-size:20px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}

/* Tip row */
.cq-tip{
  display:flex;align-items:flex-start;gap:14px;padding:16px 24px;
  border-bottom:1px solid rgba(164,156,144,.05);transition:background .2s ease;
}
.cq-tip:last-child{border-bottom:none}
.cq-tip:hover{background:rgba(74,124,89,.02)}
.cq-tip-applied{background:rgba(74,124,89,.04);border-left:3px solid ${COLORS.green}}
.cq-tip-icon{
  width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  font-size:18px;flex-shrink:0;background:rgba(164,156,144,.06);
}
.cq-tip-icon-done{background:rgba(74,124,89,.1)}
.cq-tip-title{font-size:13px;font-weight:700;color:${COLORS.dark}}
.cq-tip-desc{font-size:12px;color:${COLORS.textMuted};line-height:1.55;margin-top:4px}
.cq-tip-date{font-size:11px;color:${COLORS.green};margin-top:4px}

/* Tip action button */
.cq-tip-btn{
  padding:6px 16px;border-radius:10px;font-family:'DM Sans',sans-serif;
  font-size:12px;font-weight:600;border:1px solid;cursor:pointer;
  transition:all .2s ease;flex-shrink:0;
}
.cq-tip-btn-apply{color:${COLORS.green};background:rgba(74,124,89,.06);border-color:rgba(74,124,89,.15)}
.cq-tip-btn-apply:hover{background:rgba(74,124,89,.12)}
.cq-tip-btn-remove{color:${COLORS.red};background:rgba(185,28,28,.04);border-color:rgba(185,28,28,.12)}
.cq-tip-btn-remove:hover{background:rgba(185,28,28,.08)}

/* Progress bar */
.cq-progress-track{width:100%;height:10px;background:rgba(164,156,144,.08);border-radius:6px;overflow:hidden}
.cq-progress-fill{height:100%;background:linear-gradient(90deg,${COLORS.green},#6AA87A);border-radius:6px;transition:width .6s ease}

/* Goal section */
.cq-goal-form{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
.cq-goal-field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:160px}
.cq-goal-field label{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${COLORS.textMuted}}
.cq-goal-field select,.cq-goal-field input[type="date"]{
  padding:10px 14px;border-radius:12px;font-family:'DM Sans',sans-serif;
  font-size:13px;border:1px solid rgba(164,156,144,.2);background:rgba(253,252,251,.8);
  color:${COLORS.dark};outline:none;transition:border-color .2s;
}
.cq-goal-field select:focus,.cq-goal-field input[type="date"]:focus{border-color:${COLORS.green}}

/* Goal progress bar */
.cq-goal-bar-wrap{position:relative;width:100%;height:14px;background:rgba(164,156,144,.08);border-radius:8px;overflow:hidden}
.cq-goal-bar-fill{height:100%;border-radius:8px;transition:width .8s cubic-bezier(.22,1,.36,1)}
.cq-goal-bar-target{
  position:absolute;top:-4px;bottom:-4px;width:2px;background:${COLORS.dark};
  border-radius:2px;transition:left .8s cubic-bezier(.22,1,.36,1);
}

/* Goal status badges */
.cq-goal-status{
  display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
  border-radius:99px;font-size:11px;font-weight:700;
}
.cq-goal-status-on_track{background:rgba(74,124,89,.1);color:#15803D}
.cq-goal-status-behind{background:rgba(217,119,6,.1);color:#A16207}
.cq-goal-status-at_risk{background:rgba(185,28,28,.1);color:#B91C1C}

/* Goal stats row */
.cq-goal-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}
.cq-goal-stat-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${COLORS.textMuted}}
.cq-goal-stat-val{font-family:'DM Mono',monospace;font-size:18px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}

@media(max-width:768px){.cq-goal-stats{grid-template-columns:1fr}.cq-goal-form{flex-direction:column}}
`;

// -- Category SVG icons --
const CATEGORY_SVGS: Record<string, string> = {
  emballage: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  transport: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="${COLORS.green}" stroke-width="1.5"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" stroke="${COLORS.green}" stroke-width="1.5"/></svg>`,
  "matériaux": `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M7 19H3v-4m14 4h4v-4M3 9V5h4m14 0h-4M12 8v8m-4-4h8" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  poids: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 3v1m0 16v1m-9-9h1m16 0h1M5.6 5.6l.7.7m12.4 12.4l-.7-.7M5.6 18.4l.7-.7m12.4-12.4l-.7.7M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  logistique: `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2" stroke="${COLORS.green}" stroke-width="1.5"/><path d="M16 8h4l3 3v5h-7V8z" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="5.5" cy="18.5" r="2.5" stroke="${COLORS.green}" stroke-width="1.5"/><circle cx="18.5" cy="18.5" r="2.5" stroke="${COLORS.green}" stroke-width="1.5"/></svg>`,
  "économie_circulaire": `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round"/><path d="M21 3v6h-6" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "saisonnalité": `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1 0 0-5 2-7s7-1 7-2c0-5.5-4.5-10-9-10z" stroke="${COLORS.green}" stroke-width="1.5"/></svg>`,
};

// -- Component --

export default function Reduction() {
  const data = useLoaderData<typeof loader>();
  // Hooks must run unconditionally, before any early return (rules-of-hooks).
  const fetcher = useFetcher<typeof action>();
  const goalFetcher = useFetcher<typeof action>();
  const [goalTargetPct, setGoalTargetPct] = useState("30");
  const [goalDeadline, setGoalDeadline] = useState("");

  const handleRegenerate = useCallback(() => {
    fetcher.submit({ intent: "regenerate" }, { method: "POST" });
  }, [fetcher]);

  if ("error" in data) return <div style={{ padding: 40, textAlign: "center", color: "#9C9488" }}>Erreur de chargement. Rechargez la page.</div>;
  const { tips, progress, goal } = data;

  const isRegenerating =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "regenerate";
  const isSettingGoal =
    goalFetcher.state !== "idle" &&
    goalFetcher.formData?.get("intent") === "set-goal";
  const isDeletingGoal =
    goalFetcher.state !== "idle" &&
    goalFetcher.formData?.get("intent") === "delete-goal";

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

  const ringColor =
    ringPct >= 75
      ? COLORS.green
      : ringPct >= 50
        ? "#6AA87A"
        : ringPct >= 25
          ? COLORS.amber
          : COLORS.textFaint;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="cq-page">
        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 className="cq-display" style={{ fontSize: 28, color: COLORS.dark }}>
              Réduire l&apos;empreinte
            </h1>
            <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
              Suggestions personnalisées pour diminuer votre impact carbone
            </p>
          </div>
          <button
            className="cq-btn cq-btn-dark"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Calcul en cours..." : "Recalculer les suggestions"}
          </button>
        </div>

        {/* Goal section */}
        {!goal ? (
          <div className="cq-glass cq-anim" style={{ animationDelay: ".03s" }}>
            <div className="cq-glass-head">
              <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke={COLORS.green} strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="6" stroke={COLORS.green} strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="2" fill={COLORS.green} />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="cq-glass-title">Fixez un objectif de reduction</div>
                <div className="cq-glass-desc">Definissez un objectif pour suivre votre progression</div>
              </div>
            </div>
            <div className="cq-glass-body">
              <goalFetcher.Form method="POST">
                <input type="hidden" name="intent" value="set-goal" />
                <div className="cq-goal-form">
                  <div className="cq-goal-field">
                    <label htmlFor="goal-target">Objectif de reduction</label>
                    <select
                      id="goal-target"
                      name="targetPct"
                      value={goalTargetPct}
                      onChange={(e) => setGoalTargetPct(e.target.value)}
                    >
                      <option value="10">-10% CO&#x2082;e</option>
                      <option value="20">-20% CO&#x2082;e</option>
                      <option value="30">-30% CO&#x2082;e</option>
                      <option value="50">-50% CO&#x2082;e</option>
                    </select>
                  </div>
                  <div className="cq-goal-field">
                    <label htmlFor="goal-deadline">Date limite</label>
                    <input
                      id="goal-deadline"
                      type="date"
                      name="deadline"
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="cq-btn cq-btn-green"
                    disabled={isSettingGoal || !goalDeadline}
                  >
                    {isSettingGoal ? "Enregistrement..." : "Definir l'objectif"}
                  </button>
                </div>
              </goalFetcher.Form>
            </div>
          </div>
        ) : (
          <div className="cq-glass cq-anim" style={{ animationDelay: ".03s" }}>
            <div className="cq-glass-head">
              <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke={COLORS.green} strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="6" stroke={COLORS.green} strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="2" fill={COLORS.green} />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="cq-glass-title">
                  Objectif : <span className="cq-mono" style={{ color: COLORS.green }}>-{goal.targetPct}%</span> d&apos;ici le{" "}
                  {new Date(goal.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <span className={`cq-goal-status cq-goal-status-${goal.status}`}>
                {goal.status === "on_track" ? "En bonne voie" : goal.status === "behind" ? "En retard" : "A risque"}
              </span>
            </div>
            <div className="cq-glass-body">
              {/* Progress bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                    Progression : <span className="cq-mono" style={{ color: goal.status === "on_track" ? COLORS.green : goal.status === "behind" ? COLORS.amber : COLORS.red }}>{goal.actualReductionPct}%</span>
                    <span style={{ color: COLORS.textMuted }}> / {goal.targetPct}%</span>
                  </span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted }}>
                    {goal.daysRemaining} jour{goal.daysRemaining !== 1 ? "s" : ""} restant{goal.daysRemaining !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="cq-goal-bar-wrap">
                  <div
                    className="cq-goal-bar-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, goal.progressPct))}%`,
                      background: goal.status === "on_track"
                        ? `linear-gradient(90deg, ${COLORS.green}, #6AA87A)`
                        : goal.status === "behind"
                          ? `linear-gradient(90deg, ${COLORS.amber}, #E5A336)`
                          : `linear-gradient(90deg, ${COLORS.red}, #D44848)`,
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="cq-goal-stats">
                <div>
                  <div className="cq-goal-stat-label">Baseline</div>
                  <div className="cq-goal-stat-val" style={{ color: COLORS.textMuted }}>
                    {goal.baselineCo2Kg} <span style={{ fontSize: 11, color: COLORS.textFaint }}>kgCO&#x2082;e</span>
                  </div>
                </div>
                <div>
                  <div className="cq-goal-stat-label">Actuel</div>
                  <div className="cq-goal-stat-val" style={{ color: COLORS.dark }}>
                    {goal.currentCo2Kg} <span style={{ fontSize: 11, color: COLORS.textFaint }}>kgCO&#x2082;e</span>
                  </div>
                </div>
                <div>
                  <div className="cq-goal-stat-label">Cible</div>
                  <div className="cq-goal-stat-val" style={{ color: COLORS.green }}>
                    {(goal.baselineCo2Kg * (1 - goal.targetPct / 100)).toFixed(1)} <span style={{ fontSize: 11, color: COLORS.textFaint }}>kgCO&#x2082;e</span>
                  </div>
                </div>
              </div>

              {/* Delete button */}
              <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                <goalFetcher.Form method="POST">
                  <input type="hidden" name="intent" value="delete-goal" />
                  <input type="hidden" name="goalId" value={goal.id} />
                  <button
                    type="submit"
                    className="cq-btn cq-btn-ghost"
                    disabled={isDeletingGoal}
                    style={{ fontSize: 12 }}
                  >
                    {isDeletingGoal ? "Suppression..." : "Supprimer l'objectif"}
                  </button>
                </goalFetcher.Form>
              </div>
            </div>
          </div>
        )}

        {/* Summary hero */}
        <div className="cq-red-hero cq-anim">
          <div>
            <div className="cq-red-hero-label">Potentiel de réduction estimé</div>
            <div className="cq-red-hero-val">
              <span className="cq-mono">-{totalPotentialSaving}</span>
              <span className="unit">kgCO₂e</span>
              <span style={{ fontSize: 16, color: COLORS.textMuted, marginLeft: 8 }}>
                ({totalPotentialPct}%)
              </span>
            </div>
          </div>
          <div className="cq-red-hero-badge">
            <div className="cq-label" style={{ marginBottom: 4 }}>Engagements pris</div>
            <div className="cq-mono" style={{ fontSize: 24, fontWeight: 700, color: COLORS.green }}>
              {progress?.appliedTips ?? 0}
              <span style={{ color: COLORS.textMuted, fontSize: 14 }}> / {progress?.totalTips ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Progress ring + stats */}
        {progress && (
          <div className="cq-glass cq-anim" style={{ animationDelay: ".06s" }}>
            <div className="cq-glass-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
              {/* Ring */}
              <div className="cq-ring-wrap">
                <svg width="128" height="128" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(164,156,144,.08)" strokeWidth="10" />
                  <circle
                    cx="64" cy="64" r="54" fill="none"
                    stroke={ringColor}
                    strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 64 64)"
                    style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                </svg>
                <div className="cq-ring-center">
                  <span className="cq-ring-val">{ringPct}</span>
                  <span className="cq-ring-sub">/ 100</span>
                </div>
              </div>

              {/* Stats */}
              <div className="cq-red-stats">
                <div>
                  <div className="cq-red-stat-label">Empreinte actuelle</div>
                  <div className="cq-red-stat-val" style={{ color: COLORS.dark }}>
                    {progress.totalCarbonKg} <span style={{ fontSize: 12, color: COLORS.textMuted }}>kgCO₂e</span>
                  </div>
                </div>
                <div>
                  <div className="cq-red-stat-label">Économie potentielle</div>
                  <div className="cq-red-stat-val" style={{ color: COLORS.amber }}>
                    {progress.estimatedSavingKg} <span style={{ fontSize: 12, color: COLORS.textMuted }}>kgCO₂e</span>
                  </div>
                </div>
                <div>
                  <div className="cq-red-stat-label">Engagements pris</div>
                  <div className="cq-red-stat-val" style={{ color: COLORS.green }}>
                    {progress.achievedSavingKg} <span style={{ fontSize: 12, color: COLORS.textMuted }}>kgCO₂e</span>
                  </div>
                </div>
                <div>
                  <div className="cq-red-stat-label">Réduction estimée</div>
                  <div className="cq-red-stat-val" style={{ color: COLORS.green }}>
                    {progress.reductionPct}<span style={{ fontSize: 12, color: COLORS.textMuted }}>%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tips list */}
        <div className="cq-glass cq-anim" style={{ animationDelay: ".09s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M9 18h6m-5-2a7 7 0 1 1 4 0M12 2v1" stroke={COLORS.green} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="cq-glass-title">Recommandations</div>
            </div>
            <span className="cq-pill cq-pill-gray">
              {tips.length} suggestion{tips.length !== 1 ? "s" : ""}
            </span>
          </div>

          {tips.length === 0 ? (
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" stroke={COLORS.textMuted} strokeWidth="1.5" />
                  <path d="m21 21-4.35-4.35" stroke={COLORS.textMuted} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="cq-empty-t">Aucune suggestion</div>
              <div className="cq-empty-d">
                Ajoutez des produits et recalculez pour obtenir des recommandations personnalisées.
              </div>
            </div>
          ) : (
            <div>
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  className={`cq-tip${tip.isApplied ? " cq-tip-applied" : ""}`}
                >
                  <div className={`cq-tip-icon${tip.isApplied ? " cq-tip-icon-done" : ""}`}>
                    {tip.isApplied ? (
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                        <path d="M20 6L9 17l-5-5" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span dangerouslySetInnerHTML={{
                        __html: CATEGORY_SVGS[tip.category] ?? `<svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M9 18h6m-5-2a7 7 0 1 1 4 0M12 2v1" stroke="${COLORS.green}" stroke-width="1.5" stroke-linecap="round"/></svg>`,
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span className="cq-tip-title">{tip.title}</span>
                      <span className="cq-pill cq-pill-green">
                        <span className="cq-mono">-{tip.potentialSaving.toFixed(1)}</span> kgCO₂e
                      </span>
                      {tip.potentialSavingPct != null && (
                        <span className="cq-pill cq-pill-amber">
                          -{tip.potentialSavingPct}%
                        </span>
                      )}
                    </div>
                    <div className="cq-tip-desc">{tip.description}</div>
                    {tip.isApplied && tip.appliedAt && (
                      <div className="cq-tip-date">
                        Engagement pris le {new Date(tip.appliedAt).toLocaleDateString("fr-FR")}
                      </div>
                    )}
                  </div>

                  <fetcher.Form method="POST" style={{ flexShrink: 0 }}>
                    <input type="hidden" name="intent" value={tip.isApplied ? "unapply" : "apply"} />
                    <input type="hidden" name="tipId" value={tip.id} />
                    <button
                      type="submit"
                      className={`cq-tip-btn ${tip.isApplied ? "cq-tip-btn-remove" : "cq-tip-btn-apply"}`}
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
        <div className="cq-warn cq-anim" style={{ animationDelay: ".12s" }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke={COLORS.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 4 }}>
              Avertissement — Estimations non vérifiées
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.textMuted, lineHeight: 1.6 }}>
              Les économies affichées sont des <strong style={{ color: COLORS.text }}>estimations basées sur des moyennes sectorielles ADEME</strong>.
              Elles ne constituent pas une mesure réelle de réduction. Les économies effectives dépendent
              de la mise en œuvre concrète par le marchand. Conformément à la directive EU 2024/825 (EmpCo),
              aucune claim environnementale ne doit être communiquée aux clients sans preuve vérifiable.
              Le bouton &quot;M&apos;engager&quot; enregistre une intention, pas une action vérifiée.
            </div>
          </div>
        </div>

        {/* Engagement progress */}
        {progress && (
          <div className="cq-glass cq-anim" style={{ animationDelay: ".15s" }}>
            <div className="cq-glass-body" style={{ textAlign: "center" }}>
              <div className="cq-label" style={{ marginBottom: 12 }}>
                Score d&apos;engagement : <span className="cq-mono" style={{ color: COLORS.green }}>{progress.reductionScore}/100</span>
              </div>
              <div className="cq-progress-track">
                <div className="cq-progress-fill" style={{ width: `${progress.reductionScore}%` }} />
              </div>
              <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 12 }}>
                {progress.reductionScore >= 75
                  ? "Excellent ! Vous êtes un leader de la réduction carbone."
                  : progress.reductionScore >= 50
                    ? "Bien joué ! Continuez à appliquer les recommandations."
                    : progress.reductionScore >= 25
                      ? "Bon début ! Chaque action compte pour la planète."
                      : "Commencez par appliquer quelques recommandations simples."}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
