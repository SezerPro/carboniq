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
import {
  createABTest,
  endTest,
  getTestResults,
  type TestType,
} from "../lib/abtest/abtest.server";

// ── Loader ─────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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
  equivalence: "\u00c9quivalence",
};

const TEST_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  badge_style: { color: "#7c3aed", bg: "#ede9fe" },
  offset_placement: { color: "#0891b2", bg: "#cffafe" },
  messaging: { color: "#ea580c", bg: "#ffedd5" },
  equivalence: { color: "#16a34a", bg: "#dcfce7" },
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

// ── Presets ──────────────────────────────────────────

const PRESETS = [
  { icon: "🎨", name: "Pill vs Leaf", desc: "Comparez les 2 styles de badge les plus populaires", type: "badge_style",
    a: '{"style":"pill","showScore":true,"showLabel":true}', b: '{"style":"leaf","showScore":true,"showLabel":true}' },
  { icon: "💬", name: "Impact vs Score brut", desc: "Texte descriptif vs valeur numerique", type: "messaging",
    a: '{"text":"Faible impact carbone","showIcon":true}', b: '{"text":"4.0 kg CO₂e","showIcon":false}' },
  { icon: "🚗", name: "Voiture vs Netflix", desc: "Quelle equivalence convertit le mieux ?", type: "equivalence",
    a: '{"equivalence":"car","text":"= {value} km en voiture","icon":"🚗"}', b: '{"equivalence":"netflix","text":"= {value}h de streaming","icon":"📺"}' },
  { icon: "📍", name: "Avant vs Apres panier", desc: "Testez le placement de l'offset", type: "offset_placement",
    a: '{"position":"before_add_to_cart","label":"Compenser"}', b: '{"position":"after_add_to_cart","label":"Rendre neutre"}' },
];

// ── Component ──────────────────────────────────────────

export default function ABTestPage() {
  const { activeTests, completedTests } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [showCreate, setShowCreate] = useState(false);
  const [trafficSplit, setTrafficSplit] = useState(50);

  const isSubmitting = fetcher.state !== "idle";

  return (
    <s-page heading="A/B Testing" backAction={{ url: "/app" }}>
      <s-button
        slot="primary-action"
        onClick={() => setShowCreate(!showCreate)}
      >
        {showCreate ? "Annuler" : "Nouveau test"}
      </s-button>

      {/* ── Quick launch presets ── */}
      {!showCreate && activeTests.length === 0 && (
        <div style={{ ...card, marginBottom: 20, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Tests populaires</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>Lancez un test en 1 clic — pas besoin de JSON.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {PRESETS.map((p, i) => (
              <fetcher.Form key={i} method="POST">
                <input type="hidden" name="intent" value="create" />
                <input type="hidden" name="name" value={p.name} />
                <input type="hidden" name="testType" value={p.type} />
                <input type="hidden" name="variantA" value={p.a} />
                <input type="hidden" name="variantB" value={p.b} />
                <input type="hidden" name="trafficSplit" value="0.5" />
                <button type="submit" disabled={isSubmitting} style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb",
                  background: "#fff", cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
                  fontFamily: "inherit",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(99,102,241,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ fontSize: 18, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{p.desc}</div>
                </button>
              </fetcher.Form>
            ))}
          </div>
        </div>
      )}

      {/* ── Create form (advanced) ── */}
      {showCreate && (
        <div style={{ ...card, marginBottom: 20, border: "2px solid #6366f1" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", background: "linear-gradient(135deg, #eff6ff, #ede9fe)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Creer un test A/B personnalise</div>
          </div>
          <div style={{ padding: 20 }}>
            <fetcher.Form method="POST">
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="trafficSplit" value={(trafficSplit / 100).toString()} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Nom du test</label>
                  <input name="name" placeholder="Ex: Badge vert vs badge bleu" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Type de test</label>
                  <select name="testType" required style={inputStyle}>
                    <option value="badge_style">Badge style</option>
                    <option value="offset_placement">Offset placement</option>
                    <option value="messaging">Messaging</option>
                    <option value="equivalence">Equivalence</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Variant A (JSON)</label>
                  <textarea name="variantA" required rows={4} placeholder='{"style":"pill","showScore":true}' style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }} />
                </div>
                <div>
                  <label style={labelStyle}>Variant B (JSON)</label>
                  <textarea name="variantB" required rows={4} placeholder='{"style":"leaf","showScore":true}' style={{ ...inputStyle, fontFamily: "monospace", resize: "vertical" }} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Repartition du trafic : {trafficSplit}% A / {100 - trafficSplit}% B</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>A</span>
                  <input type="range" min={10} max={90} value={trafficSplit} onChange={(e) => setTrafficSplit(parseInt(e.target.value))} style={{ flex: 1, accentColor: "#6366f1" }} />
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>B</span>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} style={{ padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", color: "white", background: "linear-gradient(135deg, #6366f1, #4f46e5)", opacity: isSubmitting ? 0.6 : 1, fontFamily: "inherit" }}>
                {isSubmitting ? "Creation..." : "Lancer le test"}
              </button>
            </fetcher.Form>
          </div>
        </div>
      )}

      {/* ── Z-test explanation ── */}
      {activeTests.length > 0 && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📊</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 2 }}>Comment lire les resultats</div>
            <div style={{ fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>
              <strong>Z-score</strong> mesure la difference entre les variantes. Quand <strong>|Z| &gt; 1.96</strong>, le resultat est <strong style={{ color: "#16a34a" }}>significatif a 95%</strong> — il y a moins de 5% de chance que la difference soit due au hasard.
              En general, il faut <strong>~500 impressions par variante</strong> pour obtenir un resultat fiable.
            </div>
          </div>
        </div>
      )}

      {/* ── Active tests ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: "#22c55e", display: "inline-block",
          }} />
          Tests actifs ({activeTests.length})
        </div>

        {activeTests.length === 0 && (
          <div style={{ ...card, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Aucun test actif. Creez un nouveau test pour commencer.
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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: "#9ca3af", display: "inline-block",
            }} />
            Tests termines ({completedTests.length})
          </div>

          {completedTests.map((test) => (
            <CompletedTestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </s-page>
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

function BadgePreview({ label, config, color }: { label: string; config: string; color: string }) {
  let parsed: Record<string, any> = {};
  try { parsed = JSON.parse(config); } catch {}
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {Object.entries(parsed).map(([k, v]) => (
            <span key={k} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280", fontFamily: "monospace" }}>
              {k}: {String(v)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActiveTestCard({ test, fetcher }: { test: TestData; fetcher: ReturnType<typeof useFetcher> }) {
  const typeCfg = TEST_TYPE_COLORS[test.testType] ?? { color: "#6b7280", bg: "#f3f4f6" };
  const totalImpressions = test.impressionsA + test.impressionsB;
  const daysSinceStart = Math.max(1, Math.ceil((Date.now() - new Date(test.startedAt).getTime()) / (1000 * 60 * 60 * 24)));
  const dailyRate = totalImpressions / daysSinceStart;

  return (
    <div style={{ ...card, marginBottom: 16 }}>
      {/* Top color bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />

      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{test.name}</span>
          <span style={{
            padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            color: typeCfg.color, backgroundColor: typeCfg.bg,
          }}>
            {TEST_TYPE_LABELS[test.testType] ?? test.testType}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          Depuis le {new Date(test.startedAt).toLocaleDateString("fr-FR")}
        </div>
      </div>

      {/* Side-by-side variants */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
        <VariantColumn
          label="Variant A"
          color="#6366f1"
          impressions={test.impressionsA}
          conversions={test.conversionsA}
          conversionRate={test.conversionRateA}
          revenue={test.revenueA}
          isWinner={test.recommendedWinner === "A"}
        />
        <VariantColumn
          label="Variant B"
          color="#ec4899"
          impressions={test.impressionsB}
          conversions={test.conversionsB}
          conversionRate={test.conversionRateB}
          revenue={test.revenueB}
          isWinner={test.recommendedWinner === "B"}
          borderLeft
        />
      </div>

      {/* Preview badges */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid #f3f4f6", background: "#f9fafb" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Apercu des variantes</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <BadgePreview label="Variant A" config={test.variantA} color="#6366f1" />
          <BadgePreview label="Variant B" config={test.variantB} color="#ec4899" />
        </div>
      </div>

      {/* AI Recommendation + Time estimate */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid #f3f4f6", background: "#fefce8", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Recommandation</div>
          <div style={{ fontSize: 12, color: "#a16207", lineHeight: 1.5 }}>
            {test.isSignificant
              ? `La variante ${test.recommendedWinner} est statistiquement meilleure (Z=${test.zScore.toFixed(2)}). Nous recommandons de terminer le test et d'appliquer cette variante.`
              : totalImpressions === 0
                ? "Aucune donnee collectee. Le test est actif — les resultats apparaitront quand des visiteurs verront votre badge."
                : totalImpressions < 100
                  ? `Seulement ${totalImpressions} impressions collectees. Il faut environ 500+ impressions par variante pour un resultat fiable. Continuez le test.`
                  : `${totalImpressions} impressions collectees. ${test.conversionRateA > test.conversionRateB ? "La variante A" : "La variante B"} est en tete mais le resultat n'est pas encore significatif. Estimez encore ~${Math.max(0, Math.ceil((1000 - totalImpressions) / Math.max(1, dailyRate)))} jours.`
            }
          </div>
        </div>
      </div>

      {/* Significance & actions */}
      <div style={{ padding: "14px 20px", borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            color: test.isSignificant ? "#16a34a" : "#9ca3af",
            backgroundColor: test.isSignificant ? "#dcfce7" : "#f3f4f6",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: test.isSignificant ? "#16a34a" : "#d1d5db" }} />
            {test.isSignificant ? "Significatif (95%)" : "En cours"}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>Z = {test.zScore.toFixed(2)}</span>
          {!test.isSignificant && totalImpressions > 0 && (
            <span style={{ fontSize: 11, color: "#d97706" }}>~{Math.max(0, Math.ceil((1000 - totalImpressions) / Math.max(1, dailyRate)))}j restants</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {test.recommendedWinner && (
            <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a", padding: "4px 12px", borderRadius: 6, backgroundColor: "#f0fdf4" }}>
              Gagnant : Variant {test.recommendedWinner}
            </span>
          )}
          <fetcher.Form method="POST" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value="end" />
            <input type="hidden" name="testId" value={test.id} />
            <input type="hidden" name="winner" value={test.recommendedWinner ?? (test.conversionRateA >= test.conversionRateB ? "A" : "B")} />
            <button type="submit" style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid #e5e7eb", cursor: "pointer", color: "#374151", background: "#fff", fontFamily: "inherit" }}>
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
    <div style={{
      padding: "20px",
      borderLeft: borderLeft ? "1px solid #f3f4f6" : "none",
      backgroundColor: isWinner ? "#f0fdf4" : "transparent",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: 3,
          backgroundColor: color,
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
        {isWinner && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#16a34a",
            padding: "1px 6px", borderRadius: 4,
            backgroundColor: "#dcfce7",
          }}>LEADER</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCell label="Impressions" value={impressions.toLocaleString("fr-FR")} />
        <StatCell label="Conversions" value={conversions.toLocaleString("fr-FR")} />
        <StatCell
          label="Taux de conversion"
          value={`${(conversionRate * 100).toFixed(2)}%`}
          highlight
        />
        <StatCell
          label="Revenue"
          value={`${revenue.toFixed(2)} EUR`}
        />
      </div>
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 18 : 15, fontWeight: 700,
        color: highlight ? "#111827" : "#374151",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
    </div>
  );
}

function CompletedTestCard({ test }: { test: TestData }) {
  const typeCfg = TEST_TYPE_COLORS[test.testType] ?? { color: "#6b7280", bg: "#f3f4f6" };
  const isWinnerA = test.winnerVariant === "A";
  const isWinnerB = test.winnerVariant === "B";

  return (
    <div style={{ ...card, marginBottom: 12, opacity: 0.85 }}>
      <div style={{ height: 3, backgroundColor: "#d1d5db" }} />
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{test.name}</span>
          <span style={{
            padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            color: typeCfg.color, backgroundColor: typeCfg.bg,
          }}>
            {TEST_TYPE_LABELS[test.testType] ?? test.testType}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            color: "#16a34a", backgroundColor: "#dcfce7",
          }}>
            Gagnant : Variant {test.winnerVariant}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {test.endedAt ? new Date(test.endedAt).toLocaleDateString("fr-FR") : ""}
          </span>
        </div>
      </div>
      <div style={{
        padding: "0 20px 14px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12,
      }}>
        <MiniStat label="Impr. A" value={test.impressionsA} highlight={isWinnerA} />
        <MiniStat label="Conv. A" value={`${(test.conversionRateA * 100).toFixed(2)}%`} highlight={isWinnerA} />
        <MiniStat label="Rev. A" value={`${test.revenueA.toFixed(0)}EUR`} highlight={isWinnerA} />
        <MiniStat label="Impr. B" value={test.impressionsB} highlight={isWinnerB} />
        <MiniStat label="Conv. B" value={`${(test.conversionRateB * 100).toFixed(2)}%`} highlight={isWinnerB} />
        <MiniStat label="Rev. B" value={`${test.revenueB.toFixed(0)}EUR`} highlight={isWinnerB} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: highlight ? "#16a34a" : "#374151",
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 13,
  boxSizing: "border-box",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
