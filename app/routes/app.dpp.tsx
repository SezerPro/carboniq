import { useCallback, useEffect, useState } from "react";
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
import { requireFeature } from "../lib/plans/gates.server";
import { generateDPP, generateAllDPPs } from "../lib/dpp/generator.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

// -- Loader --

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "dpp_basic");

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { products: [], shopDomain: session.shop };

  const products = await db.product.findMany({
    where: { shopId: shop.id },
    orderBy: { updatedAt: "desc" },
  });

  return {
    shopDomain: session.shop,
    products: products.map((p) => ({
      id: p.id,
      shopifyProductId: p.shopifyProductId,
      title: p.title,
      productType: p.productType,
      vendor: p.vendor,
      carbonScoreKg: p.carbonScoreKg,
      carbonLabel: p.carbonLabel,
      categoryCode: p.categoryCode,
      confidence: p.confidence,
      dppGeneratedAt: p.dppGeneratedAt?.toISOString() ?? null,
      dppQrCodeUrl: p.dppQrCodeUrl,
      dppMaterials: p.dppMaterials,
      dppOriginCountry: p.dppOriginCountry,
      dppRecyclability: p.dppRecyclability,
      dppDurabilityYears: p.dppDurabilityYears,
      dppCareInstructions: p.dppCareInstructions,
      dppEndOfLife: p.dppEndOfLife,
      dppCertifications: p.dppCertifications,
      dppRepairabilityIdx: p.dppRepairabilityIdx,
      dppSparePartsYears: p.dppSparePartsYears,
      dppEnergyClass: p.dppEnergyClass,
    })),
  };
};

// -- Action --

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await requireFeature(session.shop, "dpp_basic");
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!shop) return { error: "Shop not found" };

  if (intent === "generate-all") {
    const result = await generateAllDPPs(shop.id);
    return {
      success: true,
      count: result.count,
      errors: result.errors,
    };
  }

  if (intent === "generate-one") {
    const productId = formData.get("productId") as string;
    if (!productId) return { error: "productId manquant" };
    await generateDPP(productId);
    return { success: true, count: 1 };
  }

  if (intent === "update-dpp") {
    const productId = formData.get("productId") as string;
    if (!productId) return { error: "productId manquant" };

    // Build materials JSON from form fields
    const matNames = formData.getAll("mat_name") as string[];
    const matPcts = formData.getAll("mat_pct") as string[];
    const matRecycled = formData.getAll("mat_recycled") as string[];
    const materials = matNames
      .map((name, i) => ({
        name: name.trim(),
        percentage: parseFloat(matPcts[i]) || 0,
        recycled: matRecycled[i] === "true",
      }))
      .filter((m) => m.name && m.percentage > 0);

    await db.product.update({
      where: { id: productId },
      data: {
        dppMaterials: materials.length > 0 ? JSON.stringify(materials) : null,
        dppOriginCountry: (formData.get("origin") as string) || null,
        dppRecyclability: (formData.get("recyclability") as string) || null,
        dppDurabilityYears: parseFloat(formData.get("durability") as string) || null,
        dppCareInstructions: (formData.get("care") as string) || null,
        dppEndOfLife: (formData.get("endoflife") as string) || null,
        dppCertifications: (formData.get("certifications") as string) || null,
        dppRepairabilityIdx: parseFloat(formData.get("repairability") as string) || null,
        dppSparePartsYears: parseInt(formData.get("spareparts") as string) || null,
        dppEnergyClass: (formData.get("energyclass") as string) || null,
      },
    });

    await generateDPP(productId);
    return { success: true };
  }

  return { error: "Unknown intent" };
};

// -- Label colors --

const LABEL_COLORS: Record<string, { pill: string }> = {
  LOW: { pill: "cq-pill-green" },
  MEDIUM: { pill: "cq-pill-amber" },
  HIGH: { pill: "cq-pill-amber" },
  VERY_HIGH: { pill: "cq-pill-red" },
};

// -- DPP Categories --

const DPP_CATEGORIES = [
  {
    code: "textile", label: "Textile & Mode", icon: "T", color: COLORS.blue, bg: "rgba(59,111,192,.08)",
    matPlaceholders: ["Coton", "Polyester", "Lin", "Laine", "Soie", "Viscose", "Nylon"],
    certOptions: ["GOTS", "OEKO-TEX Standard 100", "GRS (Global Recycled Standard)", "Bluesign", "EU Ecolabel", "Fair Trade"],
    carePlaceholder: "Lavage 30 C, pas de seche-linge, repassage doux",
    endOfLifeOptions: ["Point de collecte textile", "Don / seconde main", "Recyclage fibre", "Compost (fibres naturelles)"],
    extraFields: ["washTemp", "fabricWeight"],
  },
  {
    code: "electronics", label: "Electronique", icon: "E", color: COLORS.amber, bg: "rgba(217,119,6,.08)",
    matPlaceholders: ["Aluminium", "Plastique ABS", "Verre", "Lithium", "Cuivre", "Acier"],
    certOptions: ["Energy Star", "EPEAT", "TCO Certified", "RoHS", "CE", "FCC"],
    carePlaceholder: "Eviter l'humidite, nettoyer avec un chiffon sec",
    endOfLifeOptions: ["Dechetterie DEEE", "Programme reprise fabricant", "Point de collecte electronique", "Reconditionne"],
    extraFields: ["repairability", "spareparts", "energyclass"],
  },
  {
    code: "food", label: "Alimentaire", icon: "A", color: COLORS.green, bg: "rgba(74,124,89,.08)",
    matPlaceholders: ["Ingredient principal", "Emballage carton", "Film plastique"],
    certOptions: ["Agriculture Biologique (AB)", "Fairtrade", "Label Rouge", "AOP/AOC", "MSC (peche durable)", "Rainforest Alliance"],
    carePlaceholder: "Conserver au frais entre 4 C et 8 C. A consommer avant la DLC.",
    endOfLifeOptions: ["Bac de tri selectif (emballage)", "Compost (residus alimentaires)", "Poubelle classique"],
    extraFields: ["storageConditions"],
  },
  {
    code: "beauty", label: "Cosmetique & Beaute", icon: "B", color: COLORS.purple, bg: "rgba(109,77,184,.08)",
    matPlaceholders: ["Eau", "Glycerine", "Beurre de karite", "Huile de jojoba", "Acide hyaluronique"],
    certOptions: ["Cosmos Organic", "Cosmos Natural", "Ecocert", "Vegan Society", "Cruelty Free (Leaping Bunny)", "Natrue"],
    carePlaceholder: "Conserver a l'abri de la chaleur. Utiliser dans les 12 mois apres ouverture.",
    endOfLifeOptions: ["Bac de tri selectif (flacon)", "Verre collecte verre", "Consigne", "Poubelle classique"],
    extraFields: ["pao", "notTestedOnAnimals"],
  },
  {
    code: "furniture", label: "Mobilier & Maison", icon: "M", color: COLORS.amber, bg: "rgba(217,119,6,.06)",
    matPlaceholders: ["Bois de chene", "Bois de pin", "MDF", "Acier", "Tissu", "Mousse polyurethane"],
    certOptions: ["FSC", "PEFC", "EU Ecolabel", "NF Environnement", "GREENGUARD", "Ange Bleu"],
    carePlaceholder: "Nettoyer avec un chiffon humide. Eviter l'exposition directe au soleil.",
    endOfLifeOptions: ["Dechetterie (encombrants)", "Don / revente", "Recyclage bois", "Desassemblage composants"],
    extraFields: ["vocEmissions"],
  },
  {
    code: "sports", label: "Sport & Loisirs", icon: "S", color: COLORS.blue, bg: "rgba(59,111,192,.06)",
    matPlaceholders: ["Carbone", "Aluminium", "Caoutchouc", "Nylon", "Neoprene", "Polyester technique"],
    certOptions: ["Bluesign", "Fair Wear Foundation", "GRS", "ISO 14001"],
    carePlaceholder: "Rincer apres usage en eau salee. Stocker a l'abri de l'humidite.",
    endOfLifeOptions: ["Dechetterie", "Programme reprise marque", "Revente / don", "Recyclage metal"],
    extraFields: [],
  },
  {
    code: "books", label: "Livres & Papeterie", icon: "L", color: COLORS.dark, bg: "rgba(44,40,37,.05)",
    matPlaceholders: ["Papier", "Carton", "Encre vegetale", "Colle"],
    certOptions: ["FSC", "PEFC", "Imprim'Vert", "EU Ecolabel", "Ange Bleu"],
    carePlaceholder: "Conserver a l'abri de l'humidite et de la lumiere directe.",
    endOfLifeOptions: ["Bac de tri papier", "Don / bibliotheque", "Recyclage papier"],
    extraFields: [],
  },
  {
    code: "toys", label: "Jouets & Enfants", icon: "J", color: COLORS.red, bg: "rgba(185,28,28,.06)",
    matPlaceholders: ["Plastique ABS", "Bois", "Tissu", "Silicone", "Carton"],
    certOptions: ["CE (obligatoire)", "EN 71 (securite jouets)", "FSC", "GOTS (peluches)", "Oeko-Tex"],
    carePlaceholder: "Nettoyer avec un chiffon humide. Ne convient pas aux enfants de moins de 3 ans (petites pieces).",
    endOfLifeOptions: ["Don / ressourcerie", "Bac de tri (si plastique)", "Poubelle classique"],
    extraFields: ["ageMinimum"],
  },
  {
    code: "jewelry", label: "Bijoux & Accessoires", icon: "X", color: COLORS.purple, bg: "rgba(109,77,184,.06)",
    matPlaceholders: ["Or", "Argent", "Acier inoxydable", "Cuir", "Pierre naturelle", "Laiton"],
    certOptions: ["RJC (Responsible Jewellery Council)", "Fairmined", "Kimberly Process", "Fair Trade Gold"],
    carePlaceholder: "Eviter le contact avec l'eau et les parfums. Ranger dans un ecrin.",
    endOfLifeOptions: ["Revente / recyclage metaux precieux", "Don", "Refonte chez un bijoutier"],
    extraFields: ["metalPurity"],
  },
  {
    code: "generic", label: "Autre / Generique", icon: "G", color: COLORS.textMuted, bg: "rgba(164,156,144,.06)",
    matPlaceholders: ["Materiau principal", "Emballage"],
    certOptions: ["EU Ecolabel", "ISO 14001", "B Corp"],
    carePlaceholder: "Consulter les instructions du fabricant.",
    endOfLifeOptions: ["Bac de tri selectif", "Dechetterie", "Poubelle classique", "Don"],
    extraFields: [],
  },
];

// -- Page CSS --

const PAGE_CSS = `
.dpp-cat-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.dpp-cat-btn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px;border-radius:12px;font-size:11px;font-weight:500;cursor:pointer;transition:all .15s ease;border:1px solid rgba(164,156,144,.1);background:rgba(253,252,251,.5);color:${COLORS.textMuted}}
.dpp-cat-btn.active{border-width:2px}
.dpp-cat-icon{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.dpp-edit-panel{border-radius:20px;border:2px solid ${COLORS.green};padding:28px;margin-bottom:16px}
.dpp-section-title{font-size:13px;font-weight:600;color:${COLORS.text};margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(164,156,144,.08);display:flex;align-items:center;gap:8px}
.dpp-section-icon{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center}
.dpp-input,.dpp-select,.dpp-textarea{width:100%;padding:8px 12px;border-radius:10px;border:1px solid rgba(164,156,144,.18);font-size:13px;font-family:'DM Sans',sans-serif;background:rgba(253,252,251,.7);box-sizing:border-box;transition:border-color .2s}
.dpp-input:focus,.dpp-select:focus,.dpp-textarea:focus{outline:none;border-color:rgba(74,124,89,.4)}
.dpp-textarea{resize:vertical}
.dpp-field-label{display:block;font-size:12px;font-weight:500;color:${COLORS.text};margin-bottom:4px}
.dpp-cert-tag{font-size:11px;padding:3px 8px;border-radius:8px;background:rgba(164,156,144,.06);color:${COLORS.textMuted};border:1px solid rgba(164,156,144,.08)}
.dpp-mat-add{font-size:12px;color:${COLORS.green};background:none;border:none;cursor:pointer;font-weight:500;padding:4px 0}
.dpp-link{font-size:12px;font-weight:500;cursor:pointer;background:none;border:none;padding:0}
.dpp-dot{width:8px;height:8px;border-radius:50%}
@media(max-width:768px){.dpp-cat-grid{grid-template-columns:repeat(3,1fr)}}
`;

// -- Component --

export default function DPP() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [matRows, setMatRows] = useState(1);

  const isGenerating = fetcher.state !== "idle";
  const generated = products.filter((p) => p.dppGeneratedAt).length;

  // Toast feedback after action
  useEffect(() => {
    if (!fetcher.data) return;
    if ("count" in fetcher.data && fetcher.data.count) {
      shopify.toast.show(`${fetcher.data.count} DPP genere${(fetcher.data.count as number) > 1 ? "s" : ""} avec succes !`);
    } else if ("success" in fetcher.data) {
      shopify.toast.show("DPP mis a jour !");
    }
  }, [fetcher.data, shopify]);

  const handleGenerateAll = useCallback(() => {
    fetcher.submit({ intent: "generate-all" }, { method: "POST" });
  }, [fetcher]);

  const editProduct = products.find((p) => p.id === editingProduct);

  return (
    <div className="cq-page">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      {/* Header with action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="cq-display" style={{ fontSize: 28, color: COLORS.dark, marginBottom: 4 }}>Passeport Produit Digital (DPP)</h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>Conformite ESPR 2024/1781</p>
        </div>
        <button className="cq-btn cq-btn-green" onClick={handleGenerateAll} disabled={isGenerating}>
          {isGenerating ? "Generation en cours..." : "Generer tous les DPP"}
        </button>
      </div>

      {/* Info banner */}
      <div className="cq-info cq-anim">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="M3 21V5a2 2 0 012-2h6.5L13 5h6a2 2 0 012 2v14" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 13h6M9 17h3" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>
        <div className="cq-info-text">
          <strong>Preparez-vous a la reglementation EU 2027</strong><br/>
          {"Le Passeport Numerique Produit (ESPR 2024/1781) sera obligatoire des 2027 pour le textile et progressivement pour d'autres secteurs. Carboniq genere automatiquement les fiches environnementales conformes avec QR code verifiable pour chacun de vos produits."}
        </div>
      </div>

      {/* Stats */}
      <div className="cq-metrics cq-stagger">
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.dark }} />
          <div className="cq-metric-label">Produits total</div>
          <div className="cq-metric-val cq-display">{products.length}</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.green }} />
          <div className="cq-metric-label">DPP generes</div>
          <div className="cq-metric-val cq-display" style={{ color: COLORS.green }}>{generated}</div>
        </div>
        <div className="cq-metric cq-anim">
          <div className="cq-metric-accent" style={{ background: COLORS.amber }} />
          <div className="cq-metric-label">En attente</div>
          <div className="cq-metric-val cq-display" style={{ color: COLORS.amber }}>{products.length - generated}</div>
        </div>
      </div>

      {/* Edit section */}
      {editingProduct && editProduct && (() => {
        const existingMats: Array<{ name: string; percentage: number; recycled: boolean }> = editProduct.dppMaterials ? (() => { try { return JSON.parse(editProduct.dppMaterials); } catch { return []; } })() : [];
        const initMats = existingMats.length > 0 ? existingMats : [{ name: "", percentage: 0, recycled: false }];

        const detectedCat = selectedCategory
          ?? (editProduct.categoryCode?.split(".")[0] ?? "generic");
        const catConfig = DPP_CATEGORIES.find((c) => c.code === detectedCat) ?? DPP_CATEGORIES[DPP_CATEGORIES.length - 1];
        const hasExtra = (f: string) => (catConfig.extraFields as readonly string[]).includes(f);

        return (
        <div className="cq-glass dpp-edit-panel cq-anim">
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark }}>Fiche DPP : {editProduct.title}</div>
            <button onClick={() => { setEditingProduct(null); setSelectedCategory(null); setMatRows(1); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: COLORS.textMuted }}>&#10005;</button>
          </div>

          {/* Category selector */}
          <div style={{ marginBottom: 20 }}>
            <div className="cq-label" style={{ marginBottom: 8 }}>Categorie du produit</div>
            <div className="dpp-cat-grid">
              {DPP_CATEGORIES.map((c) => (
                <button key={c.code} type="button" onClick={() => setSelectedCategory(c.code)}
                  className={`dpp-cat-btn${detectedCat === c.code ? " active" : ""}`}
                  style={detectedCat === c.code ? { borderColor: c.color, background: c.bg, color: c.color } : undefined}
                >
                  <div className="dpp-cat-icon" style={{ backgroundColor: detectedCat === c.code ? `${c.color}20` : "rgba(164,156,144,.06)", color: detectedCat === c.code ? c.color : COLORS.textMuted }}>{c.icon}</div>
                  <span style={{ textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <fetcher.Form method="POST">
            <input type="hidden" name="intent" value="update-dpp" />
            <input type="hidden" name="productId" value={editProduct.id} />

            {/* Section: Origine */}
            <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={COLORS.green} strokeWidth="2"/><circle cx="12" cy="10" r="3" stroke={COLORS.green} strokeWidth="2"/></svg>} text="Origine & fabrication" />
            <div className="cq-grid-2" style={{ marginBottom: 20 }}>
              <DPPField label="Pays de fabrication" name="origin" value={editProduct.dppOriginCountry} placeholder="France, Chine, Bangladesh..." />
              <DPPField label="Duree de vie estimee (annees)" name="durability" value={editProduct.dppDurabilityYears?.toString()} placeholder="Ex: 3" type="number" />
            </div>

            {/* Section: Materiaux */}
            <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>} text="Composition" />
            <div style={{ marginBottom: 20 }}>
              {Array.from({ length: Math.max(initMats.length, matRows) }).map((_, i) => {
                const m = initMats[i] ?? { name: "", percentage: 0, recycled: false };
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 80px auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                    <div>
                      {i === 0 && <label className="dpp-field-label">{catConfig.code === "food" ? "Ingredient / emballage" : catConfig.code === "beauty" ? "Ingredient INCI" : "Materiau"}</label>}
                      <input name="mat_name" defaultValue={m.name} placeholder={catConfig.matPlaceholders[i % catConfig.matPlaceholders.length]} className="dpp-input" />
                    </div>
                    <div>
                      {i === 0 && <label htmlFor={`mat_pct_${i}`} className="dpp-field-label">%</label>}
                      <input id={`mat_pct_${i}`} name="mat_pct" type="number" step="any" defaultValue={m.percentage > 0 ? m.percentage : ""} placeholder="60" className="dpp-input" />
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="hidden" name="mat_recycled" value="false" />
                        <input type="checkbox" name="mat_recycled" value="true" defaultChecked={m.recycled} style={{ accentColor: COLORS.green }} />
                        Recycle
                      </label>
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={() => setMatRows((r) => r + 1)} className="dpp-mat-add">
                + Ajouter un materiau
              </button>
            </div>

            {/* Section: Recyclabilite */}
            <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M7.5 4.27l-3 5.2a1 1 0 00.87 1.5h2.13l-1 4.53a.5.5 0 00.88.39l5.12-6.39a.5.5 0 00-.39-.83h-2.13l1.5-4.07a.5.5 0 00-.47-.68H8a.5.5 0 00-.5.35z" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} text="Recyclabilite & fin de vie" />
            <div className="cq-grid-2" style={{ marginBottom: 20 }}>
              <div>
                <label htmlFor="dpp-recyclability" className="dpp-field-label">Recyclabilite</label>
                <select id="dpp-recyclability" name="recyclability" defaultValue={editProduct.dppRecyclability ?? ""} className="dpp-select">
                  <option value="">&#8212; Selectionner &#8212;</option>
                  <option value="Entierement recyclable">Entierement recyclable</option>
                  <option value="Partiellement recyclable">Partiellement recyclable</option>
                  <option value="Non recyclable">Non recyclable</option>
                  <option value="Compostable industriel">Compostable (industriel)</option>
                  <option value="Compostable domestique">Compostable (domestique)</option>
                  <option value="Biodegradable">Biodegradable</option>
                  <option value="Consigne">Consigne / reutilisable</option>
                </select>
              </div>
              <div>
                <label htmlFor="dpp-endoflife" className="dpp-field-label">Instructions fin de vie</label>
                <select id="dpp-endoflife" name="endoflife" defaultValue={editProduct.dppEndOfLife ?? ""} className="dpp-select">
                  <option value="">&#8212; Selectionner &#8212;</option>
                  {catConfig.endOfLifeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Section: Entretien */}
            <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2v2m0 16v2M4 12H2m20 0h-2m-2.93-7.07l-1.41 1.41M7.34 16.66l-1.41 1.41m0-12.14l1.41 1.41m9.32 9.32l1.41 1.41" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>} text="Entretien & durabilite" />
            <div style={{ marginBottom: 20 }}>
              <DPPField label="Instructions d'entretien" name="care" value={editProduct.dppCareInstructions} placeholder={catConfig.carePlaceholder} textarea />
            </div>

            {/* Section: Certifications */}
            <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} text="Certifications" />
            <div style={{ marginBottom: 8 }}>
              <DPPField label="Certifications obtenues" name="certifications" value={editProduct.dppCertifications} placeholder={catConfig.certOptions.slice(0, 3).join(", ")} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {catConfig.certOptions.map((cert) => (
                <span key={cert} className="dpp-cert-tag">{cert}</span>
              ))}
            </div>

            {/* Section: Electronique */}
            {hasExtra("repairability") && (
              <>
                <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} text="Reparabilite (Electronique)" />
                <div className="cq-grid-3" style={{ marginBottom: 20 }}>
                  <DPPField label="Indice de reparabilite (0-10)" name="repairability" value={editProduct.dppRepairabilityIdx?.toString()} placeholder="7.2" type="number" />
                  <DPPField label="Pieces detachees (annees)" name="spareparts" value={editProduct.dppSparePartsYears?.toString()} placeholder="5" type="number" />
                  <div>
                    <label htmlFor="dpp-energyclass" className="dpp-field-label">Classe energie</label>
                    <select id="dpp-energyclass" name="energyclass" defaultValue={editProduct.dppEnergyClass ?? ""} className="dpp-select">
                      <option value="">&#8212;</option>
                      {["A", "B", "C", "D", "E", "F", "G"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Section: Cosmetique */}
            {hasExtra("pao") && (
              <>
                <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M8 2h8l4 10H4L8 2zM12 12v10M8 22h8" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>} text="Specifique cosmetique" />
                <div className="cq-grid-2" style={{ marginBottom: 20 }}>
                  <DPPField label="PAO &#8212; Periode apres ouverture (mois)" name="durability" value={editProduct.dppDurabilityYears ? (editProduct.dppDurabilityYears * 12).toString() : ""} placeholder="12" type="number" />
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.text, marginTop: 20, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked={editProduct.dppCertifications?.includes("Cruelty")} style={{ accentColor: COLORS.green }} />
                      Non teste sur les animaux
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Section: Jouets */}
            {hasExtra("ageMinimum") && (
              <>
                <DPPSectionTitle icon={<svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={COLORS.green} strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round"/></svg>} text="Securite jouets" />
                <div className="cq-grid-2" style={{ marginBottom: 20 }}>
                  <DPPField label="Age minimum recommande" name="durability" value={editProduct.dppDurabilityYears?.toString()} placeholder="3" type="number" />
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.text, marginTop: 20, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: COLORS.red }} />
                      Conforme CE / EN 71
                    </label>
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="cq-btn cq-btn-green" style={{ marginTop: 4 }}>
              Sauvegarder et regenerer le DPP
            </button>
          </fetcher.Form>
        </div>
        );
      })()}

      {/* Products table */}
      <div className="cq-glass cq-anim" style={{ animationDelay: ".15s" }}>
        <div className="cq-glass-head">
          <div className="cq-glass-icon" style={{ background: COLORS.greenLight }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke={COLORS.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="cq-glass-title">Fiches produit</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="cq-tbl">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Categorie</th>
                <th>CO&#8322;</th>
                <th>Impact</th>
                <th>DPP</th>
                <th>QR Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const labelCfg = p.carbonLabel ? LABEL_COLORS[p.carbonLabel] : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, color: COLORS.dark, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title}
                    </td>
                    <td>
                      <span className="cq-pill cq-pill-gray">{p.categoryCode ?? "&#8212;"}</span>
                    </td>
                    <td>
                      {p.carbonScoreKg != null ? (
                        <span className="cq-mono" style={{ fontWeight: 600 }}>
                          {p.carbonScoreKg < 1 ? p.carbonScoreKg.toFixed(2) : p.carbonScoreKg.toFixed(1)} kgCO&#8322;e
                        </span>
                      ) : (
                        <span style={{ color: COLORS.textFaint }}>&#8212;</span>
                      )}
                    </td>
                    <td>
                      {labelCfg ? (
                        <span className={`cq-pill ${labelCfg.pill}`}>
                          {p.carbonLabel === "VERY_HIGH" ? "Tres eleve" : p.carbonLabel === "HIGH" ? "Eleve" : p.carbonLabel === "MEDIUM" ? "Modere" : "Faible"}
                        </span>
                      ) : (
                        <span style={{ color: COLORS.textFaint }}>&#8212;</span>
                      )}
                    </td>
                    <td>
                      {p.dppGeneratedAt ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: COLORS.green }}>
                          <span className="dpp-dot" style={{ backgroundColor: COLORS.green }} />
                          Genere
                        </span>
                      ) : (
                        <span style={{ color: COLORS.textMuted, fontSize: 12 }}>En attente</span>
                      )}
                    </td>
                    <td>
                      {p.dppQrCodeUrl ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span
                            role="button"
                            tabIndex={0}
                            className="dpp-link"
                            style={{ color: COLORS.green }}
                            onClick={() => { window.open(p.dppQrCodeUrl!, "_blank"); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") window.open(p.dppQrCodeUrl!, "_blank"); }}
                          >
                            Voir la fiche
                          </span>
                          <span style={{ color: COLORS.textFaint }}>&#183;</span>
                          <span
                            role="button"
                            tabIndex={0}
                            className="dpp-link"
                            style={{ color: COLORS.textMuted }}
                            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${p.dppQrCodeUrl}`); shopify.toast.show("Lien DPP copie !"); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { navigator.clipboard.writeText(`${window.location.origin}${p.dppQrCodeUrl}`); shopify.toast.show("Lien DPP copie !"); } }}
                          >
                            Copier
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: COLORS.textFaint, fontSize: 12 }}>&#8212;</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => setEditingProduct(p.id)}
                          className="dpp-link"
                          style={{ color: COLORS.green }}
                        >
                          Modifier
                        </button>
                        {!p.dppGeneratedAt ? (
                          <fetcher.Form method="POST">
                            <input type="hidden" name="intent" value="generate-one" />
                            <input type="hidden" name="productId" value={p.id} />
                            <button type="submit" className="dpp-link" style={{ color: COLORS.green }}>
                              Generer
                            </button>
                          </fetcher.Form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// -- Sub-components --

function DPPSectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="dpp-section-title">
      <div className="dpp-section-icon" style={{ background: COLORS.greenLight }}>{icon}</div>
      {text}
    </div>
  );
}

function DPPField({ label, name, value, placeholder, type, textarea }: {
  label?: string; name: string; value?: string | null; placeholder?: string; type?: string; textarea?: boolean;
}) {
  return (
    <div>
      {label && <label className="dpp-field-label">{label}</label>}
      {textarea ? (
        <textarea name={name} defaultValue={value ?? ""} placeholder={placeholder} rows={2} className="dpp-textarea" />
      ) : (
        <input name={name} type={type ?? "text"} defaultValue={value ?? ""} placeholder={placeholder} className="dpp-input" step={type === "number" ? "any" : undefined} />
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
