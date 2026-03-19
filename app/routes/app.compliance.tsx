import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, Form } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { scanShopCompliance, getLatestScan, getCompliantTemplates, getScanHistory } from "../lib/compliance/scanner.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { scan: null, templates: getCompliantTemplates(), history: [], score: 100 };

  const latestScan = await getLatestScan(shop.id);
  const scan = latestScan
    ? {
        scannedAt: latestScan.scannedAt.toISOString(),
        totalPages: latestScan.totalPages,
        totalIssues: latestScan.totalIssues,
        findings: JSON.parse(latestScan.findings),
      }
    : null;

  // Scan history
  const rawHistory = await getScanHistory(shop.id, 10);
  const history = rawHistory.map((h) => ({
    scannedAt: h.scannedAt.toISOString(),
    totalPages: h.totalPages,
    totalIssues: h.totalIssues,
  }));

  // Compliance score: 100% if 0 issues, decreases per issue severity
  const findings = scan?.findings ?? [];
  const criticalWeight = 25;
  const highWeight = 15;
  const mediumWeight = 5;
  const lowWeight = 2;
  const penalty = findings.reduce((sum: number, f: any) => {
    if (f.severity === "critical") return sum + criticalWeight;
    if (f.severity === "high") return sum + highWeight;
    if (f.severity === "medium") return sum + mediumWeight;
    if (f.severity === "low") return sum + lowWeight;
    return sum;
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { scan, templates: getCompliantTemplates(), history, score };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "scan") {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });
    if (!shop) return { error: "Shop not found" };

    const result = await scanShopCompliance(shop.id, admin);
    return {
      scan: {
        scannedAt: new Date().toISOString(),
        totalPages: result.totalProducts,
        totalIssues: result.totalIssues,
        findings: result.findings,
      },
    };
  }

  return null;
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  critical: { color: "#dc2626", bg: "#fee2e2", border: "#fecaca", label: "Critique" },
  high: { color: "#ea580c", bg: "#ffedd5", border: "#fed7aa", label: "Haut" },
  medium: { color: "#d97706", bg: "#fef3c7", border: "#fde68a", label: "Moyen" },
  low: { color: "#2563eb", bg: "#dbeafe", border: "#bfdbfe", label: "Faible" },
  info: { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", label: "Info" },
};

export default function Compliance() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  const scan = (data as any)?.scan ?? null;
  const templates = (data as any)?.templates ?? [];
  const history = (data as any)?.history ?? [];
  const score = (data as any)?.score ?? 100;

  const findings = scan?.findings ?? [];

  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    if (counts[f.severity as keyof typeof counts] !== undefined) {
      counts[f.severity as keyof typeof counts]++;
    }
  }

  // Countdown to September 2026
  const deadline = new Date("2026-09-27T00:00:00Z");
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Score color
  const scoreColor = score >= 90 ? "#16a34a" : score >= 70 ? "#d97706" : "#dc2626";
  const scoreBg = score >= 90 ? "#dcfce7" : score >= 70 ? "#fef3c7" : "#fee2e2";

  return (
    <s-page heading="Conformite EU — Green Claims" backAction={{ url: "/app" }}>

      {/* ── ROW 1: Countdown + Score ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Countdown */}
        <div style={{ ...card, padding: 24, background: "linear-gradient(135deg, #1e293b, #334155)", border: "none", color: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Directive EU EmpCo 2024/825
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{daysLeft}</span>
            <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>jours restants</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
            Entree en vigueur : 27 septembre 2026
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden", marginTop: 12 }}>
            <div style={{ height: "100%", width: `${Math.max(5, 100 - (daysLeft / 365) * 100)}%`, background: daysLeft > 180 ? "linear-gradient(90deg, #22c55e, #4ade80)" : daysLeft > 60 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #ef4444, #f87171)", borderRadius: 99 }} />
          </div>
        </div>

        {/* Score */}
        <div style={{ ...card, padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
          {/* Circular score */}
          <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
            <svg width="90" height="90" viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="38" fill="none" stroke="#f3f4f6" strokeWidth="8" />
              <circle cx="45" cy="45" r="38" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 * (1 - score / 100)}
                transform="rotate(-90 45 45)" style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: scoreColor }}>{score}</span>
              <span style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>/ 100</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Score de conformite</div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              {score >= 90 ? "Excellent ! Votre boutique est conforme." : score >= 70 ? "Quelques points a corriger." : "Attention, des claims problematiques ont ete detectees."}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, padding: "3px 10px", borderRadius: 99, background: scoreBg, color: scoreColor, fontSize: 12, fontWeight: 600 }}>
              {score >= 90 ? "Conforme" : score >= 70 ? "A ameliorer" : "Non conforme"}
            </div>
          </div>
        </div>
      </div>

      {/* ── Directive info banner ── */}
      <div style={{ ...card, marginBottom: 20, background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)", border: "1px solid #bfdbfe" }}>
        <div style={{ padding: 20, display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, color: "#fff" }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>Ce que scanne Carboniq</div>
            <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6 }}>
              Titres et descriptions de <strong>produits</strong>, <strong>collections</strong> et <strong>pages CMS</strong>.
              Carboniq detecte les termes interdits par la directive EU (neutre en carbone, eco-friendly, 100% vert, etc.)
              et propose des formulations conformes.
            </div>
          </div>
        </div>
      </div>

      {/* ── Scan button ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <Form method="post">
          <input type="hidden" name="intent" value="scan" />
          <button type="submit" disabled={isScanning} style={{
            padding: "11px 24px", borderRadius: 10, border: "none",
            background: isScanning ? "#9ca3af" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: isScanning ? "not-allowed" : "pointer",
            boxShadow: isScanning ? "none" : "0 2px 8px rgba(59,130,246,0.3)", transition: "all 0.15s ease",
            fontFamily: "inherit",
          }}>
            {isScanning ? "Scan en cours..." : "Scanner ma boutique"}
          </button>
        </Form>
        {scan?.scannedAt && (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            Dernier scan : {new Date(scan.scannedAt).toLocaleString("fr-FR")} — {scan.totalPages} elements analyses (produits + collections + pages)
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      {scan && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
            {(["critical", "high", "medium", "low", "info"] as const).map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} style={{ ...card, position: "relative", overflow: "hidden", padding: "16px 18px" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: cfg.color }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {cfg.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                    {counts[sev]}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    {counts[sev] === 1 ? "probleme" : "problemes"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Findings list ── */}
          {findings.length > 0 ? (
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                  {findings.length} probleme{findings.length > 1 ? "s" : ""} detecte{findings.length > 1 ? "s" : ""}
                </div>
              </div>
              <div>
                {findings.map((finding: any, i: number) => {
                  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "16px 20px",
                        borderBottom: i < findings.length - 1 ? "1px solid #f3f4f6" : "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {/* Severity badge */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: cfg.color,
                          padding: "3px 10px", borderRadius: 6,
                          backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`,
                          textTransform: "uppercase", letterSpacing: "0.03em",
                        }}>
                          {cfg.label}
                        </span>
                        {/* Problematic term */}
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: "#dc2626",
                          backgroundColor: "#fee2e2", padding: "2px 8px", borderRadius: 4,
                          fontFamily: "monospace",
                        }}>
                          "{finding.term}"
                        </span>
                        {/* Source */}
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>
                          {finding.source}
                        </span>
                      </div>
                      {/* Context */}
                      <div style={{
                        fontSize: 12, color: "#6b7280", fontStyle: "italic",
                        backgroundColor: "#f9fafb", padding: "8px 12px", borderRadius: 6,
                        lineHeight: 1.5,
                      }}>
                        {finding.context}
                      </div>
                      {/* Suggestion */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: "#16a34a",
                          backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: 4,
                          flexShrink: 0,
                        }}>
                          Suggestion
                        </span>
                        <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                          {finding.suggestion}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              ...card, marginBottom: 20, padding: 40,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>OK</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>
                Aucun probleme detecte
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Votre boutique est conforme aux exigences EU Green Claims.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Compliant templates ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Modeles de claims conformes
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            Remplacez vos allegations vagues par ces formulations conformes a la directive EU
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Categorie</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>A eviter</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Formulation conforme</th>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pourquoi</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#374151" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px",
                      borderRadius: 6, fontSize: 12, backgroundColor: "#f3f4f6",
                    }}>
                      {t.category}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      color: "#dc2626", backgroundColor: "#fee2e2",
                      padding: "2px 8px", borderRadius: 4, fontSize: 12,
                      textDecoration: "line-through",
                    }}>
                      {t.banned}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      color: "#16a34a", backgroundColor: "#dcfce7",
                      padding: "2px 8px", borderRadius: 4, fontSize: 12,
                    }}>
                      {t.compliant}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    {t.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── Scan history ── */}
      {history.length > 1 && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Historique des scans</div>
          </div>
          <div style={{ padding: "4px 0" }}>
            {history.map((h: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: i < history.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.totalIssues === 0 ? "#16a34a" : h.totalIssues <= 3 ? "#d97706" : "#dc2626", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "#374151" }}>{new Date(h.scannedAt).toLocaleDateString("fr-FR")} — {new Date(h.scannedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{h.totalPages} elements</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: h.totalIssues === 0 ? "#16a34a" : "#dc2626", padding: "2px 8px", borderRadius: 6, background: h.totalIssues === 0 ? "#dcfce7" : "#fee2e2" }}>
                    {h.totalIssues} probleme{h.totalIssues !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
