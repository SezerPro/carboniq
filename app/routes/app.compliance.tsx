import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, Form } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { scanShopCompliance, getLatestScan, getCompliantTemplates } from "../lib/compliance/scanner.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) return { scan: null, templates: getCompliantTemplates() };

  const latestScan = await getLatestScan(shop.id);
  const scan = latestScan
    ? {
        scannedAt: latestScan.scannedAt.toISOString(),
        totalPages: latestScan.totalPages,
        totalIssues: latestScan.totalIssues,
        findings: JSON.parse(latestScan.findings),
      }
    : null;

  return { scan, templates: getCompliantTemplates() };
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

  // Handle both loader data and action data
  const scan = (data as any)?.scan ?? null;
  const templates = (data as any)?.templates ?? [];

  const findings = scan?.findings ?? [];

  // Count by severity
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    if (counts[f.severity as keyof typeof counts] !== undefined) {
      counts[f.severity as keyof typeof counts]++;
    }
  }

  return (
    <s-page heading="Conformite EU — Green Claims" backAction={{ url: "/app" }}>
      {/* ── Directive info banner ── */}
      <div style={{
        ...card,
        marginBottom: 20,
        background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)",
        border: "1px solid #bfdbfe",
      }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0, color: "#fff",
            }}>
              !
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", marginBottom: 6 }}>
                Directive EU "Empowering Consumers" — Green Claims
              </div>
              <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                A partir de <strong>septembre 2026</strong>, l'Union Europeenne interdit les allegations
                environnementales vagues ou non prouvees. Les termes comme "neutre en carbone",
                "eco-friendly" ou "100% vert" seront sanctionnes. Carboniq scanne votre boutique pour
                identifier les claims non conformes et vous propose des alternatives valides.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scan button ── */}
      <div style={{ marginBottom: 20 }}>
        <Form method="post">
          <input type="hidden" name="intent" value="scan" />
          <button
            type="submit"
            disabled={isScanning}
            style={{
              padding: "12px 28px",
              borderRadius: 10,
              border: "none",
              background: isScanning
                ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: isScanning ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: isScanning ? "none" : "0 2px 8px rgba(59, 130, 246, 0.3)",
            }}
          >
            {isScanning ? "Scan en cours..." : "Scanner ma boutique"}
          </button>
        </Form>
        {scan?.scannedAt && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            Dernier scan : {new Date(scan.scannedAt).toLocaleString("fr-FR")} — {scan.totalPages} produits analyses
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
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
