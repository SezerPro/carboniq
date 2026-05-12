import { useState } from "react";
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
  createABTest,
  endTest,
  getTestResults,
  type TestType,
} from "../lib/abtest/abtest.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "abtest");

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) return { tests: [], activeTests: [], completedTests: [] };

  const tests = await db.aBTest.findMany({
    where: { shopId: shop.id },
    orderBy: { startedAt: "desc" },
  });

  // Compute results for each test
  const testsWithResults = await Promise.all(
    tests.map(async (test) => {
      const results = await getTestResults(test.id);
      return {
        id: test.id,
        name: test.name,
        testType: test.testType,
        variantA: test.variantA,
        variantB: test.variantB,
        isActive: test.isActive,
        trafficSplit: test.trafficSplit,
        startedAt: test.startedAt.toISOString(),
        endedAt: test.endedAt?.toISOString() ?? null,
        winnerVariant: test.winnerVariant,
        impressionsA: test.impressionsA,
        impressionsB: test.impressionsB,
        conversionsA: test.conversionsA,
        conversionsB: test.conversionsB,
        revenueA: test.revenueA,
        revenueB: test.revenueB,
        conversionRateA: results?.conversionRateA ?? 0,
        conversionRateB: results?.conversionRateB ?? 0,
        zScore: results?.zScore ?? 0,
        isSignificant: results?.isSignificant ?? false,
        recommendedWinner: results?.recommendedWinner ?? null,
      };
    }),
  );

  return {
    tests: testsWithResults,
    activeTests: testsWithResults.filter((t) => t.isActive),
    completedTests: testsWithResults.filter((t) => !t.isActive),
  };
};

// ── Action ─────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "abtest");
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { error: "Shop not found" };

  if (intent === "create") {
    const name = formData.get("name") as string;
    const testType = formData.get("testType") as TestType;
    const variantA = formData.get("variantA") as string;
    const variantB = formData.get("variantB") as string;
    const trafficSplit = parseFloat((formData.get("trafficSplit") as string) || "0.5");

    if (!name || !testType || !variantA || !variantB) {
      return { error: "Tous les champs sont requis" };
    }

    await createABTest(shop.id, name, testType, variantA, variantB, trafficSplit);
    return { success: true };
  }

  if (intent === "end") {
    const testId = formData.get("testId") as string;
    const winner = formData.get("winner") as "A" | "B";

    if (!testId || !winner) {
      return { error: "testId et winner requis" };
    }

    await endTest(testId, winner);
    return { success: true };
  }

  return { error: "Unknown intent" };
};

// ── Constants ──────────────────────────────────────────

const TEST_TYPE_LABELS: Record<string, string> = {
  badge_style: "Badge style",
  offset_placement: "Offset placement",
  messaging: "Messaging",
  equivalence: "Équivalence",
};

const TEST_TYPE_PILL: Record<string, string> = {
  badge_style: "cq-pill cq-pill-green",
  offset_placement: "cq-pill cq-pill-blue",
  messaging: "cq-pill cq-pill-amber",
  equivalence: "cq-pill cq-pill-green",
};

// ── Presets ──────────────────────────────────────────

const PRESETS = [
  { name: "Pill vs Leaf", desc: "Comparez les 2 styles de badge les plus populaires", type: "badge_style",
    a: '{"style":"pill","showScore":true,"showLabel":true}', b: '{"style":"leaf","showScore":true,"showLabel":true}' },
  { name: "Impact vs Score brut", desc: "Texte descriptif vs valeur numérique", type: "messaging",
    a: '{"text":"Faible impact carbone","showIcon":true}', b: '{"text":"4.0 kg CO₂e","showIcon":false}' },
  { name: "Voiture vs Netflix", desc: "Quelle équivalence convertit le mieux ?", type: "equivalence",
    a: '{"equivalence":"car","text":"= {value} km en voiture","icon":"car"}', b: '{"equivalence":"netflix","text":"= {value}h de streaming","icon":"tv"}' },
  { name: "Avant vs Après panier", desc: "Testez le placement de l\'offset", type: "offset_placement",
    a: '{"position":"before_add_to_cart","label":"Compenser"}', b: '{"position":"after_add_to_cart","label":"Rendre neutre"}' },
];

const PRESET_ICONS = [
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${COLORS.green}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${COLORS.amber}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${COLORS.teal}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${COLORS.blue}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polyline points="16 8 20 8 23 11 23 16 19 16"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
];

// ── Page CSS ──────────────────────────────────────────

const PAGE_CSS = `
/* Preset card */
.cq-preset{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,.6);border-radius:16px;
  padding:18px 16px;cursor:pointer;text-align:left;
  font-family:'DM Sans',sans-serif;
  box-shadow:0 1px 3px rgba(44,40,37,.04);transition:all .2s ease;
}
.cq-preset:hover{border-color:rgba(74,124,89,.25);box-shadow:0 4px 16px rgba(74,124,89,.08);transform:translateY(-2px)}
.cq-preset:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
.cq-preset-icon{margin-bottom:10px}
.cq-preset-name{font-size:13px;font-weight:700;color:${COLORS.dark}}
.cq-preset-desc{font-size:11px;color:${COLORS.textMuted};margin-top:3px;line-height:1.4}

/* Form */
.cq-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.cq-form-label{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${COLORS.textMuted};margin-bottom:6px}
.cq-form-input{
  width:100%;padding:10px 14px;border-radius:12px;font-size:13px;
  border:1px solid rgba(164,156,144,.15);background:rgba(253,252,251,.6);
  font-family:'DM Sans',sans-serif;box-sizing:border-box;
  transition:border-color .2s;
}
.cq-form-input:focus{outline:none;border-color:${COLORS.green};box-shadow:0 0 0 3px rgba(74,124,89,.1)}
.cq-form-textarea{font-family:'DM Mono',monospace;resize:vertical}
.cq-form-range{flex:1;accent-color:${COLORS.green}}

/* Variant columns */
.cq-variant-col{padding:20px;position:relative}
.cq-variant-col--right{border-left:1px solid rgba(164,156,144,.08)}
.cq-variant-col--winner{background:rgba(74,124,89,.04)}
.cq-variant-header{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.cq-variant-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
.cq-variant-label{font-size:13px;font-weight:600;color:${COLORS.text}}
.cq-variant-leader{font-size:10px;font-weight:700;color:#15803D;padding:2px 8px;border-radius:6px;background:rgba(74,124,89,.1)}
.cq-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cq-stat-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.textMuted};margin-bottom:2px}
.cq-stat-val{font-size:15px;font-weight:700;color:${COLORS.text}}
.cq-stat-val--lg{font-size:18px;color:${COLORS.dark}}

/* Badge preview */
.cq-badge-preview{display:flex;align-items:center;gap:10px}
.cq-badge-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.cq-badge-kv{font-size:10px;padding:2px 6px;border-radius:6px;background:rgba(253,252,251,.8);border:1px solid rgba(164,156,144,.1);color:${COLORS.textMuted};font-family:'DM Mono',monospace}

/* Completed card */
.cq-completed{opacity:.85}
.cq-completed-bar{height:3px;background:${COLORS.textFaint}}
.cq-completed-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;padding:0 24px 16px}
.cq-mini-stat{text-align:center}
.cq-mini-label{font-size:10px;color:${COLORS.textMuted};margin-bottom:2px}
.cq-mini-val{font-size:13px;font-weight:700;color:${COLORS.text}}
.cq-mini-val--win{color:#15803D}

/* Active dot */
.cq-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.cq-dot--active{background:#22c55e;animation:cqPulse 2s ease-in-out infinite}
.cq-dot--inactive{background:${COLORS.textFaint}}

/* Recommendation box */
.cq-reco{
  padding:16px 20px;border-top:1px solid rgba(164,156,144,.08);
  background:rgba(217,119,6,.04);display:flex;align-items:flex-start;gap:12px;
}
.cq-reco-title{font-size:12px;font-weight:700;color:#92400e;margin-bottom:4px}
.cq-reco-text{font-size:12px;color:#A16207;line-height:1.5}

/* Section title */
.cq-section-title{font-size:15px;font-weight:700;color:${COLORS.dark};margin-bottom:12px;display:flex;align-items:center;gap:8px}

/* Top accent bar */
.cq-accent-bar{height:3px;background:linear-gradient(90deg,${COLORS.green},${COLORS.teal})}
`;

// ── Component ──────────────────────────────────────────

export default function ABTestPage() {
  const { activeTests, completedTests } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [showCreate, setShowCreate] = useState(false);
  const [trafficSplit, setTrafficSplit] = useState(50);

  const isSubmitting = fetcher.state !== "idle";

  return (
    <div className="cq-page">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      {/* Page header */}
      <div className="cq-glass cq-anim" style={{ marginBottom: 20 }}>
        <div className="cq-glass-head" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="cq-glass-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
            </div>
            <div>
              <div className="cq-glass-title">A/B Testing</div>
              <div className="cq-glass-desc">Testez et optimisez vos badges carbone</div>
            </div>
          </div>
          <button className={`cq-btn ${showCreate ? "cq-btn-ghost" : "cq-btn-green"}`} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Annuler" : "Nouveau test"}
          </button>
        </div>
      </div>

      {/* ── Quick launch presets ── */}
      {!showCreate && activeTests.length === 0 && (
        <div className="cq-glass cq-anim" style={{ animationDelay: ".06s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.amberLight, color: COLORS.amber }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div>
              <div className="cq-glass-title">Tests populaires</div>
              <div className="cq-glass-desc">Lancez un test en 1 clic — pas besoin de JSON.</div>
            </div>
          </div>
          <div className="cq-glass-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {PRESETS.map((p, i) => (
                <fetcher.Form key={i} method="POST">
                  <input type="hidden" name="intent" value="create" />
                  <input type="hidden" name="name" value={p.name} />
                  <input type="hidden" name="testType" value={p.type} />
                  <input type="hidden" name="variantA" value={p.a} />
                  <input type="hidden" name="variantB" value={p.b} />
                  <input type="hidden" name="trafficSplit" value="0.5" />
                  <button type="submit" disabled={isSubmitting} className="cq-preset">
                    <div className="cq-preset-icon" dangerouslySetInnerHTML={{ __html: PRESET_ICONS[i] }} />
                    <div className="cq-preset-name">{p.name}</div>
                    <div className="cq-preset-desc">{p.desc}</div>
                  </button>
                </fetcher.Form>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Create form (advanced) ── */}
      {showCreate && (
        <div className="cq-glass cq-anim" style={{ borderColor: `rgba(74,124,89,.3)` }}>
          <div className="cq-glass-head" style={{ background: "rgba(74,124,89,.04)" }}>
            <div className="cq-glass-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div className="cq-glass-title">Créer un test A/B personnalisé</div>
          </div>
          <div className="cq-glass-body">
            <fetcher.Form method="POST">
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="trafficSplit" value={(trafficSplit / 100).toString()} />

              <div className="cq-form-grid">
                <div>
                  <label htmlFor="abtest-name" className="cq-form-label">Nom du test</label>
                  <input id="abtest-name" name="name" placeholder="Ex: Badge vert vs badge bleu" required className="cq-form-input" />
                </div>
                <div>
                  <label htmlFor="abtest-type" className="cq-form-label">Type de test</label>
                  <select id="abtest-type" name="testType" required className="cq-form-input">
                    <option value="badge_style">Badge style</option>
                    <option value="offset_placement">Offset placement</option>
                    <option value="messaging">Messaging</option>
                    <option value="equivalence">Équivalence</option>
                  </select>
                </div>
              </div>

              <div className="cq-form-grid">
                <div>
                  <label htmlFor="abtest-variantA" className="cq-form-label">Variant A (JSON)</label>
                  <textarea id="abtest-variantA" name="variantA" required rows={4} placeholder='{"style":"pill","showScore":true}' className="cq-form-input cq-form-textarea" />
                </div>
                <div>
                  <label htmlFor="abtest-variantB" className="cq-form-label">Variant B (JSON)</label>
                  <textarea id="abtest-variantB" name="variantB" required rows={4} placeholder='{"style":"leaf","showScore":true}' className="cq-form-input cq-form-textarea" />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="cq-form-label">Répartition du trafic : {trafficSplit}% A / {100 - trafficSplit}% B</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600 }}>A</span>
                  <input type="range" min={10} max={90} value={trafficSplit} onChange={(e) => setTrafficSplit(parseInt(e.target.value))} className="cq-form-range" />
                  <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600 }}>B</span>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="cq-btn cq-btn-green">
                {isSubmitting ? "Création..." : "Lancer le test"}
              </button>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* ── Z-test explanation ── */}
      {activeTests.length > 0 && (
        <div className="cq-info cq-anim" style={{ animationDelay: ".06s" }}>
          <svg className="cq-info-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <div className="cq-info-text">
            <strong>Comment lire les résultats :</strong> le <strong>Z-score</strong> mesure la différence entre les variantes. Quand <strong>|Z| &gt; 1.96</strong>, le résultat est <strong>significatif à 95%</strong> — il y a moins de 5% de chance que la différence soit due au hasard. En général, il faut <strong>~500 impressions par variante</strong> pour un résultat fiable.
          </div>
        </div>
      )}

      {/* ── Active tests ── */}
      <div style={{ marginBottom: 28 }}>
        <div className="cq-section-title">
          <span className="cq-dot cq-dot--active" />
          Tests actifs ({activeTests.length})
        </div>

        {activeTests.length === 0 && (
          <div className="cq-glass">
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="cq-empty-t">Aucun test actif</div>
              <div className="cq-empty-d">Créez un nouveau test pour commencer à optimiser vos badges carbone.</div>
            </div>
          </div>
        )}

        {activeTests.map((test) => (
          <ActiveTestCard key={test.id} test={test} fetcher={fetcher} />
        ))}
      </div>

      {/* ── Completed tests ── */}
      {completedTests.length > 0 && (
        <div>
          <div className="cq-section-title">
            <span className="cq-dot cq-dot--inactive" />
            Tests terminés ({completedTests.length})
          </div>

          {completedTests.map((test) => (
            <CompletedTestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────

type TestData = {
  id: string;
  name: string;
  testType: string;
  variantA: string;
  variantB: string;
  isActive: boolean;
  trafficSplit: number;
  startedAt: string;
  endedAt: string | null;
  winnerVariant: string | null;
  impressionsA: number;
  impressionsB: number;
  conversionsA: number;
  conversionsB: number;
  revenueA: number;
  revenueB: number;
  conversionRateA: number;
  conversionRateB: number;
  zScore: number;
  isSignificant: boolean;
  recommendedWinner: string | null;
};

function BadgePreview({ label, config, colorHex }: { label: string; config: string; colorHex: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: Record<string, any> = {};
  try { parsed = JSON.parse(config); } catch { /* ignore parse errors */ }
  return (
    <div className="cq-badge-preview">
      <span className="cq-badge-dot" style={{ background: colorHex }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(parsed).map(([k, v]) => (
            <span key={k} className="cq-badge-kv">
              {k}: {String(v)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActiveTestCard({ test, fetcher }: { test: TestData; fetcher: ReturnType<typeof useFetcher> }) {
  const typePill = TEST_TYPE_PILL[test.testType] ?? "cq-pill cq-pill-gray";
  const totalImpressions = test.impressionsA + test.impressionsB;
  const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(test.startedAt).getTime()) / (1000 * 60 * 60 * 24)));
  const dailyRate = totalImpressions / daysSinceStart;

  return (
    <div className="cq-glass cq-anim" style={{ animationDelay: ".09s" }}>
      {/* Top color bar */}
      <div className="cq-accent-bar" />

      {/* Header */}
      <div className="cq-glass-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>{test.name}</span>
          <span className={typePill}>
            {TEST_TYPE_LABELS[test.testType] ?? test.testType}
          </span>
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted }}>
          Depuis le {new Date(test.startedAt).toLocaleDateString("fr-FR")}
        </div>
      </div>

      {/* Side-by-side variants */}
      <div className="cq-grid-2" style={{ gap: 0 }}>
        <VariantColumn
          label="Variant A"
          color={COLORS.green}
          impressions={test.impressionsA}
          conversions={test.conversionsA}
          conversionRate={test.conversionRateA}
          revenue={test.revenueA}
          isWinner={test.recommendedWinner === "A"}
        />
        <VariantColumn
          label="Variant B"
          color={COLORS.amber}
          impressions={test.impressionsB}
          conversions={test.conversionsB}
          conversionRate={test.conversionRateB}
          revenue={test.revenueB}
          isWinner={test.recommendedWinner === "B"}
          borderLeft
        />
      </div>

      {/* Preview badges */}
      <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(164,156,144,.08)", background: "rgba(164,156,144,.02)" }}>
        <div className="cq-label" style={{ marginBottom: 10 }}>Aperçu des variantes</div>
        <div className="cq-grid-2">
          <BadgePreview label="Variant A" config={test.variantA} colorHex={COLORS.green} />
          <BadgePreview label="Variant B" config={test.variantB} colorHex={COLORS.amber} />
        </div>
      </div>

      {/* Recommendation */}
      <div className="cq-reco">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div style={{ flex: 1 }}>
          <div className="cq-reco-title">Recommandation</div>
          <div className="cq-reco-text">
            {test.isSignificant
              ? `La variante ${test.recommendedWinner} est statistiquement meilleure (Z=${test.zScore.toFixed(2)}). Nous recommandons de terminer le test et d'appliquer cette variante.`
              : totalImpressions === 0
                ? "Aucune donnée collectée. Le test est actif — les résultats apparaîtront quand des visiteurs verront votre badge."
                : totalImpressions < 100
                  ? `Seulement ${totalImpressions} impressions collectées. Il faut environ 500+ impressions par variante pour un résultat fiable. Continuez le test.`
                  : `${totalImpressions} impressions collectées. ${test.conversionRateA > test.conversionRateB ? "La variante A" : "La variante B"} est en tête mais le résultat n'est pas encore significatif. Estimez encore ~${Math.max(0, Math.ceil((1000 - totalImpressions) / Math.max(1, dailyRate)))} jours.`
            }
          </div>
        </div>
      </div>

      {/* Significance & actions */}
      <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(164,156,144,.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={`cq-pill ${test.isSignificant ? "cq-pill-green" : "cq-pill-gray"}`}>
            <span className={`cq-dot ${test.isSignificant ? "" : ""}`} style={{ width: 6, height: 6, background: test.isSignificant ? "#15803D" : COLORS.textFaint }} />
            {test.isSignificant ? "Significatif (95%)" : "En cours"}
          </span>
          <span className="cq-mono" style={{ fontSize: 11, color: COLORS.textMuted }}>Z = {test.zScore.toFixed(2)}</span>
          {!test.isSignificant && totalImpressions > 0 && (
            <span className="cq-pill cq-pill-amber" style={{ fontSize: 10 }}>~{Math.max(0, Math.ceil((1000 - totalImpressions) / Math.max(1, dailyRate)))}j restants</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {test.recommendedWinner && (
            <span className="cq-pill cq-pill-green">
              Gagnant : Variant {test.recommendedWinner}
            </span>
          )}
          <fetcher.Form method="POST" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value="end" />
            <input type="hidden" name="testId" value={test.id} />
            <input type="hidden" name="winner" value={test.recommendedWinner ?? (test.conversionRateA >= test.conversionRateB ? "A" : "B")} />
            <button type="submit" className="cq-btn cq-btn-ghost" style={{ padding: "6px 16px", fontSize: 12 }}>
              Terminer le test
            </button>
          </fetcher.Form>
        </div>
      </div>
    </div>
  );
}

function VariantColumn({ label, color, impressions, conversions, conversionRate, revenue, isWinner, borderLeft }: {
  label: string;
  color: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  isWinner: boolean;
  borderLeft?: boolean;
}) {
  return (
    <div className={`cq-variant-col${borderLeft ? " cq-variant-col--right" : ""}${isWinner ? " cq-variant-col--winner" : ""}`}>
      <div className="cq-variant-header">
        <span className="cq-variant-dot" style={{ backgroundColor: color }} />
        <span className="cq-variant-label">{label}</span>
        {isWinner && <span className="cq-variant-leader">LEADER</span>}
      </div>

      <div className="cq-stat-grid">
        <StatCell label="Impressions" value={impressions.toLocaleString("fr-FR")} />
        <StatCell label="Conversions" value={conversions.toLocaleString("fr-FR")} />
        <StatCell label="Taux de conversion" value={`${(conversionRate * 100).toFixed(2)}%`} highlight />
        <StatCell label="Revenue" value={`${revenue.toFixed(2)} EUR`} />
      </div>
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="cq-stat-label">{label}</div>
      <div className={`cq-mono ${highlight ? "cq-stat-val--lg" : "cq-stat-val"}`}>
        {value}
      </div>
    </div>
  );
}

function CompletedTestCard({ test }: { test: TestData }) {
  const typePill = TEST_TYPE_PILL[test.testType] ?? "cq-pill cq-pill-gray";
  const isWinnerA = test.winnerVariant === "A";
  const isWinnerB = test.winnerVariant === "B";

  return (
    <div className="cq-glass cq-completed">
      <div className="cq-completed-bar" />
      <div style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{test.name}</span>
          <span className={typePill}>
            {TEST_TYPE_LABELS[test.testType] ?? test.testType}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="cq-pill cq-pill-green">
            Gagnant : Variant {test.winnerVariant}
          </span>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>
            {test.endedAt ? new Date(test.endedAt).toLocaleDateString("fr-FR") : ""}
          </span>
        </div>
      </div>
      <div className="cq-completed-grid">
        <MiniStat label="Impr. A" value={test.impressionsA} highlight={isWinnerA} />
        <MiniStat label="Conv. A" value={`${(test.conversionRateA * 100).toFixed(2)}%`} highlight={isWinnerA} />
        <MiniStat label="Rev. A" value={`${test.revenueA.toFixed(0)} EUR`} highlight={isWinnerA} />
        <MiniStat label="Impr. B" value={test.impressionsB} highlight={isWinnerB} />
        <MiniStat label="Conv. B" value={`${(test.conversionRateB * 100).toFixed(2)}%`} highlight={isWinnerB} />
        <MiniStat label="Rev. B" value={`${test.revenueB.toFixed(0)} EUR`} highlight={isWinnerB} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="cq-mini-stat">
      <div className="cq-mini-label">{label}</div>
      <div className={`cq-mono ${highlight ? "cq-mini-val--win" : "cq-mini-val"}`}>
        {value}
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
