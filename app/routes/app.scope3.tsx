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
  getScope3Summary,
  recordScope3,
  estimateScope3,
} from "../lib/scope3/scope3.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { summary: null };

  const summary = await getScope3Summary(shop.id);
  return { summary };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { error: "Shop not found" };

  if (intent === "estimate") {
    const totalKg = await estimateScope3(shop.id);
    return { success: true, totalKg };
  }

  if (intent === "add-entry") {
    const category = formData.get("category") as string;
    const emissionKg = parseFloat(formData.get("emissionKg") as string);
    const source = formData.get("source") as string;

    if (!category || isNaN(emissionKg) || !source) {
      return { error: "Champs requis manquants" };
    }

    await recordScope3(shop.id, category, emissionKg, source);
    return { success: true };
  }

  return { error: "Intent inconnue" };
};

// ── Styles ─────────────────────────────────────────────

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  overflow: "hidden" as const,
};

const SCOPE3_CATEGORIES = [
  {
    value: "upstream_transport",
    label: "Transport amont",
    icon: "T",
    color: "#6366f1",
    desc: "Transport des matieres premieres vers les fournisseurs",
  },
  {
    value: "downstream_delivery",
    label: "Livraison clients",
    icon: "L",
    color: "#0ea5e9",
    desc: "Livraison des produits aux clients finaux",
  },
  {
    value: "packaging",
    label: "Emballage",
    icon: "E",
    color: "#f59e0b",
    desc: "Fabrication et traitement des emballages",
  },
  {
    value: "end_of_life",
    label: "Fin de vie",
    icon: "F",
    color: "#ef4444",
    desc: "Traitement et recyclage en fin de vie",
  },
  {
    value: "energy",
    label: "Energie",
    icon: "N",
    color: "#8b5cf6",
    desc: "Consommation energetique des operations",
  },
  {
    value: "other",
    label: "Autre",
    icon: "A",
    color: "#6b7280",
    desc: "Autres emissions de la chaine de valeur",
  },
];

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {};
for (const c of SCOPE3_CATEGORIES) {
  CATEGORY_META[c.value] = { label: c.label, color: c.color, icon: c.icon };
}

export default function Scope3Page() {
  const { summary } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  if (!summary) {
    return (
      <s-page heading="Scope 3 — Supply Chain" backAction={{ url: "/app" }}>
        <s-section>
          <s-paragraph>
            Installez d'abord l'app depuis le dashboard.
          </s-paragraph>
        </s-section>
      </s-page>
    );
  }

  const scope1Pct =
    summary.grandTotal > 0
      ? Math.round((summary.scope1.totalKg / summary.grandTotal) * 100)
      : 0;
  const scope3Pct = 100 - scope1Pct;

  // Prepare donut data
  const categories = Object.entries(summary.scope3.categories);
  const totalScope3Kg = summary.scope3.totalKg;

  return (
    <s-page heading="Scope 3 — Supply Chain" backAction={{ url: "/app" }}>
      {/* ── Info banner ── */}
      <div
        style={{
          ...card,
          marginBottom: 20,
          background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
          border: "1px solid #bfdbfe",
        }}
      >
        <div style={{ padding: 20 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#1e40af",
              marginBottom: 8,
            }}
          >
            Comprendre le Scope 3
          </div>
          <div
            style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, marginBottom: 16 }}
          >
            Le Scope 3 couvre les emissions indirectes de votre chaine de valeur
            : transport des matieres premieres, livraison aux clients, emballage
            et fin de vie des produits. Il represente souvent 70 a 90% de
            l'empreinte totale d'une entreprise.
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {SCOPE3_CATEGORIES.slice(0, 4).map((cat) => (
              <div
                key={cat.value}
                style={{
                  flex: "1 1 140px",
                  padding: "10px 14px",
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.7)",
                  border: `1px solid ${cat.color}30`,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: `${cat.color}18`,
                    color: cat.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  {cat.icon}
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
                >
                  {cat.label}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                  {cat.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <SummaryCard
          accent="#059669"
          label="Scope 1 — Produits"
          value={`${summary.scope1.totalKg.toFixed(1)} kg`}
          sub={`${scope1Pct}% de l'empreinte totale`}
        />
        <SummaryCard
          accent="#6366f1"
          label="Scope 3 — Supply Chain"
          value={`${summary.scope3.totalKg.toFixed(1)} kg`}
          sub={`${scope3Pct}% de l'empreinte totale`}
        />
        <SummaryCard
          accent="#111827"
          label="Empreinte totale"
          value={`${summary.grandTotal.toFixed(1)} kg`}
          sub="CO2 equivalent"
        />
      </div>

      {/* ── Scope split visual ── */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111827",
            marginBottom: 14,
          }}
        >
          Repartition Scope 1 vs Scope 3
        </div>
        <div
          style={{
            display: "flex",
            height: 32,
            borderRadius: 8,
            overflow: "hidden",
            backgroundColor: "#f3f4f6",
          }}
        >
          <div
            style={{
              width: `${scope1Pct}%`,
              backgroundColor: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              minWidth: scope1Pct > 0 ? 40 : 0,
              transition: "width 0.5s ease",
            }}
          >
            {scope1Pct > 10 ? `${scope1Pct}%` : ""}
          </div>
          <div
            style={{
              width: `${scope3Pct}%`,
              backgroundColor: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              minWidth: scope3Pct > 0 ? 40 : 0,
              transition: "width 0.5s ease",
            }}
          >
            {scope3Pct > 10 ? `${scope3Pct}%` : ""}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: "#059669",
              }}
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Produits ({summary.scope1.totalKg.toFixed(1)} kg)
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: "#6366f1",
              }}
            />
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Supply Chain ({summary.scope3.totalKg.toFixed(1)} kg)
            </span>
          </div>
        </div>
      </div>

      {/* ── Scope 3 breakdown by category (horizontal bars) ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Detail Scope 3 par categorie
          </div>
        </div>
        <div style={{ padding: 20 }}>
          {categories.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 24,
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              Aucune donnee Scope 3. Lancez une estimation automatique ou
              ajoutez une entree manuellement.
            </div>
          )}
          {categories.map(([cat, data]) => {
            const pct =
              totalScope3Kg > 0
                ? ((data as any).totalKg / totalScope3Kg) * 100
                : 0;
            const meta = CATEGORY_META[cat] ?? {
              label: cat,
              color: "#6b7280",
              icon: "?",
            };
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: `${meta.color}18`,
                        color: meta.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {meta.icon}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#374151",
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: meta.color,
                    }}
                  >
                    {(data as any).totalKg.toFixed(1)} kg ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      backgroundColor: meta.color,
                      borderRadius: 4,
                      transition: "width 0.5s ease",
                      minWidth: (data as any).totalKg > 0 ? 4 : 0,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Auto-estimate button ── */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}
            >
              Estimation automatique
            </div>
            <div
              style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}
            >
              Estimez les emissions Scope 3 a partir de vos donnees produit. Les anciennes estimations du mois en cours seront remplacees.
            </div>
          </div>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="estimate" />
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                backgroundColor: "#6366f1",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              {isSubmitting ? "Estimation en cours..." : "Estimer automatiquement"}
            </button>
          </fetcher.Form>
        </div>
        {fetcher.data && (fetcher.data as any).success && (fetcher.data as any).totalKg !== undefined && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              backgroundColor: "#dcfce7",
              border: "1px solid #bbf7d0",
              fontSize: 13,
              color: "#16a34a",
              fontWeight: 500,
            }}
          >
            Estimation terminee : {(fetcher.data as any).totalKg} kg CO2 estimes pour le Scope 3.
          </div>
        )}
      </div>

      {/* ── Manual entry form ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Ajouter une entree manuellement
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="add-entry" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 4,
                  }}
                >
                  Categorie
                </label>
                <select
                  name="category"
                  required
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    backgroundColor: "#fff",
                  }}
                >
                  {SCOPE3_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 4,
                  }}
                >
                  Emission (kg CO2)
                </label>
                <input
                  type="number"
                  name="emissionKg"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 4,
                  }}
                >
                  Source / Description
                </label>
                <input
                  type="text"
                  name="source"
                  required
                  placeholder="ex: Facture DHL mars 2026"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                color: "#374151",
                fontSize: 13,
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              Ajouter
            </button>
          </fetcher.Form>
          {fetcher.data && (fetcher.data as any).error && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: 8,
                backgroundColor: "#fee2e2",
                border: "1px solid #fecaca",
                fontSize: 12,
                color: "#dc2626",
              }}
            >
              {(fetcher.data as any).error}
            </div>
          )}
        </div>
      </div>

      {/* ── History table ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f3f4f6",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Historique des entrees Scope 3
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {summary.entries.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#9ca3af",
                fontSize: 13,
              }}
            >
              Aucune entree enregistree
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
                    Emission
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Source
                  </th>
                  <th
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#9ca3af",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Periode
                  </th>
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
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.entries.map((entry) => {
                  const meta = CATEGORY_META[entry.category] ?? {
                    label: entry.category,
                    color: "#6b7280",
                    icon: "?",
                  };
                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: "1px solid #f9fafb" }}
                    >
                      <td style={{ padding: "10px 20px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              backgroundColor: `${meta.color}18`,
                              color: meta.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {meta.icon}
                          </div>
                          <span style={{ fontWeight: 500 }}>
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {entry.emissionKg.toFixed(2)} kg
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "#6b7280",
                        }}
                      >
                        {entry.source}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "#6b7280",
                        }}
                      >
                        {entry.period}
                      </td>
                      <td
                        style={{
                          padding: "10px 20px",
                          color: "#9ca3af",
                          fontSize: 12,
                        }}
                      >
                        {new Date(entry.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Comparison insight ── */}
      <div
        style={{
          ...card,
          padding: 20,
          background: "linear-gradient(135deg, #faf5ff 0%, #eff6ff 100%)",
          border: "1px solid #e9d5ff",
          marginBottom: 20,
        }}
      >
        <div
          style={{ fontSize: 14, fontWeight: 600, color: "#7c3aed", marginBottom: 8 }}
        >
          Analyse
        </div>
        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
          Vos produits representent{" "}
          <strong style={{ color: "#059669" }}>{scope1Pct}%</strong> de votre
          empreinte totale. La supply chain represente{" "}
          <strong style={{ color: "#6366f1" }}>{scope3Pct}%</strong>.
          {scope3Pct > 50 && (
            <span>
              {" "}
              Concentrez vos efforts sur la chaine d'approvisionnement pour un
              impact maximal.
            </span>
          )}
          {scope3Pct <= 50 && scope3Pct > 0 && (
            <span>
              {" "}
              Votre empreinte produit est dominante : optimisez le choix des
              materiaux et fournisseurs.
            </span>
          )}
          {summary.grandTotal === 0 && (
            <span>
              {" "}
              Lancez une estimation automatique pour commencer votre bilan.
            </span>
          )}
        </div>
      </div>
    </s-page>
  );
}

// ── Sub-components ─────────────────────────────────────

function SummaryCard({
  accent,
  label,
  value,
  sub,
}: {
  accent: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        padding: "20px 20px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: accent,
        }}
      />
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#111827",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
