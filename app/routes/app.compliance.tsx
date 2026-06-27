import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, Form } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireFeature } from "../lib/plans/gates.server";
import { scanShopCompliance, getLatestScan, getCompliantTemplates, getScanHistory } from "../lib/compliance/scanner.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "compliance");
  try {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const penalty = findings.reduce((sum: number, f: any) => {
      if (f.severity === "critical") return sum + criticalWeight;
      if (f.severity === "high") return sum + highWeight;
      if (f.severity === "medium") return sum + mediumWeight;
      if (f.severity === "low") return sum + lowWeight;
      return sum;
    }, 0);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    return { scan, templates: getCompliantTemplates(), history, score };
  } catch (error) {
    console.error("[app.compliance] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  await requireFeature(session.shop, "compliance");
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

// ── Severity config ─────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { pill: string; label: string }> = {
  critical: { pill: "cq-pill cq-pill-red", label: "Critique" },
  high: { pill: "cq-pill cq-pill-amber", label: "Haut" },
  medium: { pill: "cq-pill cq-pill-amber", label: "Moyen" },
  low: { pill: "cq-pill cq-pill-blue", label: "Faible" },
  info: { pill: "cq-pill cq-pill-gray", label: "Info" },
};

const SEVERITY_COLORS: Record<string, { accent: string; color: string }> = {
  critical: { accent: COLORS.red, color: COLORS.red },
  high: { accent: COLORS.amber, color: COLORS.amber },
  medium: { accent: COLORS.amber, color: COLORS.amber },
  low: { accent: COLORS.blue, color: COLORS.blue },
  info: { accent: COLORS.textMuted, color: COLORS.textMuted },
};

// ── Page CSS ──────────────────────────────────────────

const PAGE_CSS = `
/* Countdown card */
.cq-countdown{
  background:${COLORS.dark};color:#FDFCFB;border-radius:20px;
  padding:28px 24px;border:none;overflow:hidden;position:relative;
}
.cq-countdown::before{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse at 30% 50%,rgba(74,124,89,.15),transparent 70%);
  pointer-events:none;
}
.cq-countdown-label{
  font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:rgba(253,252,251,.4);margin-bottom:10px;position:relative;
}
.cq-countdown-num{
  font-family:'Instrument Serif',Georgia,serif;font-size:48px;line-height:1;
  letter-spacing:-.03em;position:relative;
}
.cq-countdown-sub{font-size:14px;color:rgba(253,252,251,.5);position:relative}
.cq-countdown-date{font-size:12px;color:rgba(253,252,251,.35);margin-top:10px;position:relative}
.cq-countdown-bar{
  height:4px;background:rgba(255,255,255,.08);border-radius:99px;
  overflow:hidden;margin-top:14px;position:relative;
}
.cq-countdown-bar-fill{height:100%;border-radius:99px;transition:width .5s}

/* Score ring */
.cq-score-ring{position:relative;width:90px;height:90px;flex-shrink:0}
.cq-score-ring-val{
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
}
.cq-score-num{font-family:'Instrument Serif',Georgia,serif;font-size:24px;line-height:1}
.cq-score-denom{font-size:9px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:.05em}

/* Summary severity cards */
.cq-sev-card{
  background:rgba(253,252,251,.7);backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,.6);border-radius:18px;
  padding:18px 20px;position:relative;overflow:hidden;
  box-shadow:0 1px 3px rgba(44,40,37,.04);
}
.cq-sev-accent{position:absolute;top:0;left:0;right:0;height:3px}

/* Finding row */
.cq-finding{padding:18px 24px;border-bottom:1px solid rgba(164,156,144,.05)}
.cq-finding:last-child{border-bottom:none}
.cq-finding-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}
.cq-finding-term{
  font-size:13px;font-weight:700;color:${COLORS.red};
  background:rgba(185,28,28,.08);padding:2px 10px;border-radius:6px;
  font-family:'DM Mono',monospace;
}
.cq-finding-source{font-size:12px;color:${COLORS.textMuted}}
.cq-finding-context{
  font-size:12px;color:${COLORS.textMuted};font-style:italic;
  background:rgba(164,156,144,.04);padding:10px 14px;border-radius:10px;
  line-height:1.5;margin-bottom:8px;
}
.cq-finding-suggest{display:flex;align-items:flex-start;gap:8px}

/* History row */
.cq-history-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:12px 24px;border-bottom:1px solid rgba(164,156,144,.05);
}
.cq-history-row:last-child{border-bottom:none}
.cq-history-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
`;

export default function Compliance() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isScanning = navigation.state === "submitting";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scan = (data as any)?.scan ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const templates = (data as any)?.templates ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (data as any)?.history ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const scoreColor = score >= 90 ? "#15803D" : score >= 70 ? COLORS.amber : COLORS.red;

  return (
    <div className="cq-page">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      {/* ── Page header ── */}
      <div className="cq-glass cq-anim">
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div className="cq-glass-title">Conformité EU — Anti-greenwashing (EmpCo)</div>
            <div className="cq-glass-desc">Vérifiez vos allégations environnementales</div>
          </div>
        </div>
      </div>

      {/* ── ROW 1: Countdown + Score ── */}
      <div className="cq-grid-2 cq-anim cq-stagger" style={{ marginBottom: 16, animationDelay: ".06s" }}>
        {/* Countdown */}
        <div className="cq-countdown cq-anim">
          <div className="cq-countdown-label">Directive EU EmpCo 2024/825</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="cq-countdown-num">{daysLeft}</span>
            <span className="cq-countdown-sub">jours restants</span>
          </div>
          <div className="cq-countdown-date">Entrée en vigueur : 27 septembre 2026</div>
          <div className="cq-countdown-bar">
            <div className="cq-countdown-bar-fill" style={{
              width: `${Math.max(5, 100 - (daysLeft / 365) * 100)}%`,
              background: daysLeft > 180
                ? `linear-gradient(90deg, ${COLORS.green}, #22c55e)`
                : daysLeft > 60
                  ? `linear-gradient(90deg, ${COLORS.amber}, #fbbf24)`
                  : `linear-gradient(90deg, ${COLORS.red}, #f87171)`,
            }} />
          </div>
        </div>

        {/* Score */}
        <div className="cq-glass cq-anim" style={{ marginBottom: 0 }}>
          <div className="cq-glass-body" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Circular score */}
            <div className="cq-score-ring">
              <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(164,156,144,.1)" strokeWidth="8" />
                <circle cx="45" cy="45" r="38" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 38} strokeDashoffset={2 * Math.PI * 38 * (1 - score / 100)}
                  transform="rotate(-90 45 45)" style={{ transition: "stroke-dashoffset 1s ease" }} />
              </svg>
              <div className="cq-score-ring-val">
                <span className="cq-score-num" style={{ color: scoreColor }}>{score}</span>
                <span className="cq-score-denom">/ 100</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark, marginBottom: 4 }}>Score de conformité</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
                {score >= 90 ? "Excellent ! Votre boutique est conforme." : score >= 70 ? "Quelques points à corriger." : "Attention, des claims problématiques ont été détectées."}
              </div>
              <span className={`cq-pill ${score >= 90 ? "cq-pill-green" : score >= 70 ? "cq-pill-amber" : "cq-pill-red"}`} style={{ marginTop: 8, display: "inline-flex" }}>
                {score >= 90 ? "Conforme" : score >= 70 ? "À améliorer" : "Non conforme"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Directive info banner ── */}
      <div className="cq-info cq-anim" style={{ animationDelay: ".09s" }}>
        <svg className="cq-info-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div className="cq-info-text">
          <strong>Ce que scanne Carboniq :</strong> Titres et descriptions de <strong>produits</strong>, <strong>collections</strong> et <strong>pages CMS</strong>.
          Carboniq détecte les termes interdits par la directive EU EmpCo 2024/825 (neutre en carbone, eco-friendly, 100% vert, etc.)
          et propose des formulations conformes.
        </div>
      </div>

      {/* ── Scan button ── */}
      <div className="cq-anim" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, animationDelay: ".12s" }}>
        <Form method="post">
          <input type="hidden" name="intent" value="scan" />
          <button type="submit" disabled={isScanning} className={`cq-btn ${isScanning ? "cq-btn-ghost" : "cq-btn-green"}`}>
            {isScanning ? "Scan en cours..." : "Scanner ma boutique"}
          </button>
        </Form>
        {scan?.scannedAt && (
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>
            Dernier scan : {new Date(scan.scannedAt).toLocaleString("fr-FR")} — {scan.totalPages} éléments analysés
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      {scan && (
        <>
          <div className="cq-anim" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16, animationDelay: ".15s" }}>
            {(["critical", "high", "medium", "low", "info"] as const).map((sev) => {
              const cfg = SEVERITY_CONFIG[sev];
              const cols = SEVERITY_COLORS[sev];
              return (
                <div key={sev} className="cq-sev-card">
                  <div className="cq-sev-accent" style={{ backgroundColor: cols.accent }} />
                  <div className="cq-label">{cfg.label}</div>
                  <div className="cq-display" style={{ fontSize: 28, color: cols.color, marginTop: 6 }}>
                    {counts[sev]}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                    {counts[sev] === 1 ? "problème" : "problèmes"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Findings list ── */}
          {findings.length > 0 ? (
            <div className="cq-glass cq-anim" style={{ animationDelay: ".18s" }}>
              <div className="cq-glass-head">
                <div className="cq-glass-icon" style={{ background: COLORS.redLight, color: COLORS.red }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div className="cq-glass-title">
                  {findings.length} problème{findings.length > 1 ? "s" : ""} détecté{findings.length > 1 ? "s" : ""}
                </div>
              </div>
              <div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {findings.map((finding: any, i: number) => {
                  const cfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info;
                  return (
                    <div key={i} className="cq-finding">
                      <div className="cq-finding-header">
                        <span className={cfg.pill}>{cfg.label}</span>
                        <span className="cq-finding-term">&quot;{finding.term}&quot;</span>
                        <span className="cq-finding-source">{finding.source}</span>
                      </div>
                      <div className="cq-finding-context">{finding.context}</div>
                      <div className="cq-finding-suggest">
                        <span className="cq-pill cq-pill-green" style={{ flexShrink: 0 }}>Suggestion</span>
                        <span style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>{finding.suggestion}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="cq-glass cq-anim" style={{ animationDelay: ".18s" }}>
              <div className="cq-empty">
                <div className="cq-empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div className="cq-empty-t">Aucun problème détecté</div>
                <div className="cq-empty-d">Votre boutique est conforme aux règles EU anti-greenwashing (EmpCo).</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Compliant templates ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".21s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <div className="cq-glass-title">Modèles de claims conformes</div>
            <div className="cq-glass-desc">Remplacez vos allégations vagues par ces formulations conformes à la directive EU EmpCo</div>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="cq-tbl">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>À éviter</th>
                <th>Formulation conforme</th>
                <th>Pourquoi</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {templates.map((t: any, i: number) => (
                <tr key={i}>
                  <td>
                    <span className="cq-pill cq-pill-gray">{t.category}</span>
                  </td>
                  <td>
                    <span className="cq-pill cq-pill-red" style={{ textDecoration: "line-through" }}>{t.banned}</span>
                  </td>
                  <td>
                    <span className="cq-pill cq-pill-green">{t.compliant}</span>
                  </td>
                  <td style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
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
        <div className="cq-glass cq-anim" style={{ animationDelay: ".24s" }}>
          <div className="cq-glass-head">
            <div className="cq-glass-icon" style={{ background: COLORS.blueLight, color: COLORS.blue }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="cq-glass-title">Historique des scans</div>
          </div>
          <div>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {history.map((h: any, i: number) => (
              <div key={i} className="cq-history-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="cq-history-dot" style={{ background: h.totalIssues === 0 ? "#15803D" : h.totalIssues <= 3 ? COLORS.amber : COLORS.red }} />
                  <span style={{ fontSize: 13, color: COLORS.text }}>
                    {new Date(h.scannedAt).toLocaleDateString("fr-FR")} — {new Date(h.scannedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 12, color: COLORS.textMuted }}>{h.totalPages} éléments</span>
                  <span className={`cq-pill ${h.totalIssues === 0 ? "cq-pill-green" : "cq-pill-red"}`}>
                    {h.totalIssues} problème{h.totalIssues !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
