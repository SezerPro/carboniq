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
  getScope3Summary,
  recordScope3,
  estimateScope3,
} from "../lib/scope3/scope3.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "scope3");
  try {
    const shop = await db.shop.findUnique({
      where: { shopDomain: session.shop },
    });
    if (!shop) return { summary: null };

    const summary = await getScope3Summary(shop.id);
    return { summary };
  } catch (error) {
    console.error("[app.scope3] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "scope3");
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

// ── Category metadata ─────────────────────────────────

const SCOPE3_CATEGORIES = [
  { value: "upstream_transport", label: "Transport amont", icon: "T", color: COLORS.green, desc: "Transport des matieres premieres vers les fournisseurs" },
  { value: "downstream_delivery", label: "Livraison clients", icon: "L", color: COLORS.blue, desc: "Livraison des produits aux clients finaux" },
  { value: "packaging", label: "Emballage", icon: "E", color: COLORS.amber, desc: "Fabrication et traitement des emballages" },
  { value: "end_of_life", label: "Fin de vie", icon: "F", color: COLORS.red, desc: "Traitement et recyclage en fin de vie" },
  { value: "energy", label: "Energie", icon: "N", color: COLORS.purple, desc: "Consommation energetique des operations" },
  { value: "other", label: "Autre", icon: "A", color: COLORS.textMuted, desc: "Autres emissions de la chaine de valeur" },
];

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {};
for (const c of SCOPE3_CATEGORIES) {
  CATEGORY_META[c.value] = { label: c.label, color: c.color, icon: c.icon };
}

// ── Page CSS ──────────────────────────────────────────

const PAGE_CSS = `
.s3-bar-track{height:8px;border-radius:4px;overflow:hidden;background:rgba(164,156,144,.08)}
.s3-bar-fill{height:100%;border-radius:4px;transition:width .5s ease}
.s3-split{display:flex;height:32px;border-radius:10px;overflow:hidden;background:rgba(164,156,144,.06)}
.s3-split-seg{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#FDFCFB;transition:width .5s ease}
.s3-legend{display:flex;justify-content:space-between;margin-top:8px}
.s3-legend-item{display:flex;align-items:center;gap:6px}
.s3-legend-dot{width:10px;height:10px;border-radius:3px}
.s3-form-label{display:block;font-size:12px;font-weight:600;color:${COLORS.text};margin-bottom:4px}
.s3-input,.s3-select{width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(164,156,144,.18);font-size:13px;font-family:'DM Sans',sans-serif;background:rgba(253,252,251,.7);box-sizing:border-box;transition:border-color .2s}
.s3-input:focus,.s3-select:focus{outline:none;border-color:rgba(74,124,89,.4)}
.s3-cat-pill{flex:1 1 140px;padding:10px 14px;border-radius:12px;background:rgba(253,252,251,.7);border:1px solid rgba(164,156,144,.08)}
.s3-cat-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;margin-bottom:6px}
`;

// ── Component ─────────────────────────────────────────

export default function Scope3Page() {
  const { summary } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  if (!summary) {
    return (
      <div className="cq-page">
        <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />
        <div className="cq-glass cq-anim">
          <div className="cq-empty">
            <div className="cq-empty-icon">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={COLORS.textMuted} strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div className="cq-empty-t">Aucune donnee disponible</div>
            <div className="cq-empty-d">{"Installez d'abord l'app depuis le dashboard."}</div>
          </div>
        </div>
      </div>
    );
  }

  const scope1Pct = summary.grandTotal > 0 ? Math.round((summary.scope1.totalKg / summary.grandTotal) * 100) : 0;
  const scope3Pct = 100 - scope1Pct;
  const categories = Object.entries(summary.scope3.categories);
  const totalScope3Kg = summary.scope3.totalKg;

  return (
    <div className="cq-page">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      {/* ── Info banner ── */}
      <div className="cq-info cq-anim" style={{ flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={COLORS.green} strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.dark }}>Comprendre le Scope 3</span>
          </div>
          <div className="cq-info-text">
            Le Scope 3 couvre les emissions indirectes de votre chaine de valeur
            : transport des matieres premieres, livraison aux clients, emballage
            et fin de vie des produits. Il represente souvent <strong>70 a 90%</strong> de
            {"l'empreinte totale d'une entreprise."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SCOPE3_CATEGORIES.slice(0, 4).map((cat) => (
            <div key={cat.value} className="s3-cat-pill">
              <div className="s3-cat-icon" style={{ backgroundColor: `${cat.color}18`, color: cat.color }}>{cat.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark }}>{cat.label}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{cat.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary metrics ── */}
      <div className="cq-metrics cq-stagger">
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.green }} />
          <div className="cq-metric-label">Scope 1 — Produits</div>
          <div className="cq-metric-val"><span className="cq-mono">{summary.scope1.totalKg.toFixed(1)}</span> <span>kgCO&#8322;e</span></div>
          <div className="cq-metric-sub">{scope1Pct}% de {"l'empreinte totale"}</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.dark }} />
          <div className="cq-metric-label">Scope 3 — Supply Chain</div>
          <div className="cq-metric-val"><span className="cq-mono">{summary.scope3.totalKg.toFixed(1)}</span> <span>kgCO&#8322;e</span></div>
          <div className="cq-metric-sub">{scope3Pct}% de {"l'empreinte totale"}</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.amber }} />
          <div className="cq-metric-label">Empreinte totale</div>
          <div className="cq-metric-val"><span className="cq-mono">{summary.grandTotal.toFixed(1)}</span> <span>kgCO&#8322;e</span></div>
          <div className="cq-metric-sub">CO&#8322; equivalent</div>
        </div>
      </div>

      {/* ── Scope split visual ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".12s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke={COLORS.green} strokeWidth="2"/><path d="M12 2a10 10 0 010 20" fill={COLORS.green} opacity=".15"/></svg>
          </div>
          <div className="cq-glass-title">Repartition Scope 1 vs Scope 3</div>
        </div>
        <div className="cq-glass-body">
          <div className="s3-split">
            <div className="s3-split-seg" style={{ width: `${scope1Pct}%`, backgroundColor: COLORS.green, minWidth: scope1Pct > 0 ? 40 : 0 }}>
              {scope1Pct > 10 ? `${scope1Pct}%` : ""}
            </div>
            <div className="s3-split-seg" style={{ width: `${scope3Pct}%`, backgroundColor: COLORS.dark, minWidth: scope3Pct > 0 ? 40 : 0 }}>
              {scope3Pct > 10 ? `${scope3Pct}%` : ""}
            </div>
          </div>
          <div className="s3-legend">
            <div className="s3-legend-item">
              <div className="s3-legend-dot" style={{ backgroundColor: COLORS.green }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>Produits (<span className="cq-mono">{summary.scope1.totalKg.toFixed(1)}</span> kgCO&#8322;e)</span>
            </div>
            <div className="s3-legend-item">
              <div className="s3-legend-dot" style={{ backgroundColor: COLORS.dark }} />
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>Supply Chain (<span className="cq-mono">{summary.scope3.totalKg.toFixed(1)}</span> kgCO&#8322;e)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scope 3 breakdown by category ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".18s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="cq-glass-title">Detail Scope 3 par categorie</div>
        </div>
        <div className="cq-glass-body">
          {categories.length === 0 && (
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div className="cq-empty-t">Aucune donnee Scope 3</div>
              <div className="cq-empty-d">Lancez une estimation automatique ou ajoutez une entree manuellement.</div>
            </div>
          )}
          {categories.map(([cat, data]) => {
            const pct = totalScope3Kg > 0
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? ((data as any).totalKg / totalScope3Kg) * 100
              : 0;
            const meta = CATEGORY_META[cat] ?? { label: cat, color: COLORS.textMuted, icon: "?" };
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="s3-cat-icon" style={{ width: 24, height: 24, fontSize: 11, backgroundColor: `${meta.color}18`, color: meta.color }}>{meta.icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{meta.label}</span>
                  </div>
                  <span className="cq-mono" style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(data as any).totalKg.toFixed(1)} kgCO&#8322;e ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="s3-bar-track">
                  <div className="s3-bar-fill" style={{
                    width: `${pct}%`,
                    backgroundColor: meta.color,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    minWidth: (data as any).totalKg > 0 ? 4 : 0,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Auto-estimate ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".24s" }}>
        <div className="cq-glass-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Estimation automatique</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>
                Estimez les emissions Scope 3 a partir de vos donnees produit. Les anciennes estimations du mois en cours seront remplacees.
              </div>
            </div>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="estimate" />
              <button type="submit" disabled={isSubmitting} className="cq-btn cq-btn-green">
                {isSubmitting ? "Estimation en cours..." : "Estimer automatiquement"}
              </button>
            </fetcher.Form>
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {fetcher.data && (fetcher.data as any).success && (fetcher.data as any).totalKg !== undefined && (
            <div className="cq-info" style={{ marginTop: 12, marginBottom: 0 }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="cq-info-text">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                Estimation terminee : <strong className="cq-mono">{(fetcher.data as any).totalKg} kgCO&#8322;e</strong> estimes pour le Scope 3.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Manual entry form ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".3s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div className="cq-glass-title">Ajouter une entree manuellement</div>
        </div>
        <div className="cq-glass-body">
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="add-entry" />
            <div className="cq-grid-3" style={{ marginBottom: 14 }}>
              <div>
                <label htmlFor="scope3-category" className="s3-form-label">Categorie</label>
                <select id="scope3-category" name="category" required className="s3-select">
                  {SCOPE3_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="scope3-emissionKg" className="s3-form-label">Emission (kgCO&#8322;e)</label>
                <input id="scope3-emissionKg" type="number" name="emissionKg" step="0.01" min="0" required placeholder="0.00" className="s3-input" />
              </div>
              <div>
                <label htmlFor="scope3-source" className="s3-form-label">Source / Description</label>
                <input id="scope3-source" type="text" name="source" required placeholder="ex: Facture DHL mars 2026" className="s3-input" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="cq-btn cq-btn-ghost">Ajouter</button>
          </fetcher.Form>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {fetcher.data && (fetcher.data as any).error && (
            <div className="cq-warn" style={{ marginTop: 10, marginBottom: 0 }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={COLORS.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <span style={{ fontSize: 12.5, color: COLORS.red }}>{(fetcher.data as any).error}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── History table ── */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".36s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="cq-glass-title">Historique des entrees Scope 3</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {summary.entries.length === 0 ? (
            <div className="cq-empty">
              <div className="cq-empty-icon">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke={COLORS.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="cq-empty-t">Aucune entree enregistree</div>
              <div className="cq-empty-d">Ajoutez des entrees manuellement ou lancez une estimation automatique.</div>
            </div>
          ) : (
            <table className="cq-tbl">
              <thead>
                <tr>
                  <th>Categorie</th>
                  <th style={{ textAlign: "right" }}>Emission</th>
                  <th>Source</th>
                  <th>Periode</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {summary.entries.map((entry) => {
                  const meta = CATEGORY_META[entry.category] ?? { label: entry.category, color: COLORS.textMuted, icon: "?" };
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="s3-cat-icon" style={{ width: 22, height: 22, fontSize: 10, backgroundColor: `${meta.color}18`, color: meta.color }}>{meta.icon}</div>
                          <span style={{ fontWeight: 500 }}>{meta.label}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="cq-mono" style={{ fontWeight: 600 }}>{entry.emissionKg.toFixed(2)} kgCO&#8322;e</span>
                      </td>
                      <td style={{ color: COLORS.textMuted }}>{entry.source}</td>
                      <td style={{ color: COLORS.textMuted }}>{entry.period}</td>
                      <td style={{ color: COLORS.textFaint, fontSize: 12 }}>
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

      {/* ── Analysis insight ── */}
      <div className="cq-info cq-anim" style={{ animationDelay: ".42s" }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l.146.146A3 3 0 0118 21H6a3 3 0 01-2.682-4.658l.146-.146z" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div className="cq-info-text">
          <strong>Analyse :</strong>{" "}
          Vos produits representent{" "}
          <strong className="cq-mono" style={{ color: COLORS.green }}>{scope1Pct}%</strong> de votre
          empreinte totale. La supply chain represente{" "}
          <strong className="cq-mono" style={{ color: COLORS.dark }}>{scope3Pct}%</strong>.
          {scope3Pct > 50 && (
            <span>
              {" Concentrez vos efforts sur la chaine d'approvisionnement pour un impact maximal."}
            </span>
          )}
          {scope3Pct <= 50 && scope3Pct > 0 && (
            <span>
              {" "}Votre empreinte produit est dominante : optimisez le choix des materiaux et fournisseurs.
            </span>
          )}
          {summary.grandTotal === 0 && (
            <span>
              {" "}Lancez une estimation automatique pour commencer votre bilan.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
