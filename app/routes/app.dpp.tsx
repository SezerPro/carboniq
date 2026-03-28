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
import { generateDPP, generateAllDPPs } from "../lib/dpp/generator.server";

// -- Loader --

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

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

const LABEL_COLORS: Record<string, { color: string; bg: string }> = {
  LOW: { color: "#16a34a", bg: "#dcfce7" },
  MEDIUM: { color: "#d97706", bg: "#fef3c7" },
  HIGH: { color: "#ea580c", bg: "#ffedd5" },
  VERY_HIGH: { color: "#dc2626", bg: "#fee2e2" },
};

// -- DPP Categories --

const DPP_CATEGORIES = [
  {
    code: "textile", label: "Textile & Mode", icon: "👗", color: "#1d4ed8", bg: "#dbeafe",
    matPlaceholders: ["Coton", "Polyester", "Lin", "Laine", "Soie", "Viscose", "Nylon"],
    certOptions: ["GOTS", "OEKO-TEX Standard 100", "GRS (Global Recycled Standard)", "Bluesign", "EU Ecolabel", "Fair Trade"],
    carePlaceholder: "Lavage 30°C, pas de sèche-linge, repassage doux",
    endOfLifeOptions: ["Point de collecte textile", "Don / seconde main", "Recyclage fibre", "Compost (fibres naturelles)"],
    extraFields: ["washTemp", "fabricWeight"],
  },
  {
    code: "electronics", label: "Électronique", icon: "📱", color: "#92400e", bg: "#fef3c7",
    matPlaceholders: ["Aluminium", "Plastique ABS", "Verre", "Lithium", "Cuivre", "Acier"],
    certOptions: ["Energy Star", "EPEAT", "TCO Certified", "RoHS", "CE", "FCC"],
    carePlaceholder: "Éviter l'humidité, nettoyer avec un chiffon sec",
    endOfLifeOptions: ["Déchetterie DEEE", "Programme reprise fabricant", "Point de collecte électronique", "Reconditionné"],
    extraFields: ["repairability", "spareparts", "energyclass"],
  },
  {
    code: "food", label: "Alimentaire", icon: "🍽️", color: "#166534", bg: "#dcfce7",
    matPlaceholders: ["Ingrédient principal", "Emballage carton", "Film plastique"],
    certOptions: ["Agriculture Biologique (AB)", "Fairtrade", "Label Rouge", "AOP/AOC", "MSC (pêche durable)", "Rainforest Alliance"],
    carePlaceholder: "Conserver au frais entre 4°C et 8°C. À consommer avant la DLC.",
    endOfLifeOptions: ["Bac de tri sélectif (emballage)", "Compost (résidus alimentaires)", "Poubelle classique"],
    extraFields: ["storageConditions"],
  },
  {
    code: "beauty", label: "Cosmétique & Beauté", icon: "💄", color: "#9333ea", bg: "#f3e8ff",
    matPlaceholders: ["Eau", "Glycérine", "Beurre de karité", "Huile de jojoba", "Acide hyaluronique"],
    certOptions: ["Cosmos Organic", "Cosmos Natural", "Ecocert", "Vegan Society", "Cruelty Free (Leaping Bunny)", "Natrue"],
    carePlaceholder: "Conserver à l'abri de la chaleur. Utiliser dans les 12 mois après ouverture.",
    endOfLifeOptions: ["Bac de tri sélectif (flacon)", "Verre → collecte verre", "Consigne", "Poubelle classique"],
    extraFields: ["pao", "notTestedOnAnimals"],
  },
  {
    code: "furniture", label: "Mobilier & Maison", icon: "🪑", color: "#78350f", bg: "#fef3c7",
    matPlaceholders: ["Bois de chêne", "Bois de pin", "MDF", "Acier", "Tissu", "Mousse polyuréthane"],
    certOptions: ["FSC", "PEFC", "EU Ecolabel", "NF Environnement", "GREENGUARD", "Ange Bleu"],
    carePlaceholder: "Nettoyer avec un chiffon humide. Éviter l'exposition directe au soleil.",
    endOfLifeOptions: ["Déchetterie (encombrants)", "Don / revente", "Recyclage bois", "Désassemblage composants"],
    extraFields: ["vocEmissions"],
  },
  {
    code: "sports", label: "Sport & Loisirs", icon: "🚴", color: "#0369a1", bg: "#e0f2fe",
    matPlaceholders: ["Carbone", "Aluminium", "Caoutchouc", "Nylon", "Néoprène", "Polyester technique"],
    certOptions: ["Bluesign", "Fair Wear Foundation", "GRS", "ISO 14001"],
    carePlaceholder: "Rincer après usage en eau salée. Stocker à l'abri de l'humidité.",
    endOfLifeOptions: ["Déchetterie", "Programme reprise marque", "Revente / don", "Recyclage métal"],
    extraFields: [],
  },
  {
    code: "books", label: "Livres & Papeterie", icon: "📚", color: "#374151", bg: "#f3f4f6",
    matPlaceholders: ["Papier", "Carton", "Encre végétale", "Colle"],
    certOptions: ["FSC", "PEFC", "Imprim'Vert", "EU Ecolabel", "Ange Bleu"],
    carePlaceholder: "Conserver à l'abri de l'humidité et de la lumière directe.",
    endOfLifeOptions: ["Bac de tri papier", "Don / bibliothèque", "Recyclage papier"],
    extraFields: [],
  },
  {
    code: "toys", label: "Jouets & Enfants", icon: "🧸", color: "#dc2626", bg: "#fee2e2",
    matPlaceholders: ["Plastique ABS", "Bois", "Tissu", "Silicone", "Carton"],
    certOptions: ["CE (obligatoire)", "EN 71 (sécurité jouets)", "FSC", "GOTS (peluches)", "Oeko-Tex"],
    carePlaceholder: "Nettoyer avec un chiffon humide. Ne convient pas aux enfants de moins de 3 ans (petites pièces).",
    endOfLifeOptions: ["Don / ressourcerie", "Bac de tri (si plastique)", "Poubelle classique"],
    extraFields: ["ageMinimum"],
  },
  {
    code: "jewelry", label: "Bijoux & Accessoires", icon: "💎", color: "#7c3aed", bg: "#ede9fe",
    matPlaceholders: ["Or", "Argent", "Acier inoxydable", "Cuir", "Pierre naturelle", "Laiton"],
    certOptions: ["RJC (Responsible Jewellery Council)", "Fairmined", "Kimberly Process", "Fair Trade Gold"],
    carePlaceholder: "Éviter le contact avec l'eau et les parfums. Ranger dans un écrin.",
    endOfLifeOptions: ["Revente / recyclage métaux précieux", "Don", "Refonte chez un bijoutier"],
    extraFields: ["metalPurity"],
  },
  {
    code: "generic", label: "Autre / Générique", icon: "📦", color: "#64748b", bg: "#f1f5f9",
    matPlaceholders: ["Matériau principal", "Emballage"],
    certOptions: ["EU Ecolabel", "ISO 14001", "B Corp"],
    carePlaceholder: "Consulter les instructions du fabricant.",
    endOfLifeOptions: ["Bac de tri sélectif", "Déchetterie", "Poubelle classique", "Don"],
    extraFields: [],
  },
];

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
      shopify.toast.show(`${fetcher.data.count} DPP généré${(fetcher.data.count as number) > 1 ? "s" : ""} avec succès !`);
    } else if ("success" in fetcher.data) {
      shopify.toast.show("DPP mis à jour !");
    }
  }, [fetcher.data, shopify]);

  const handleGenerateAll = useCallback(() => {
    fetcher.submit({ intent: "generate-all" }, { method: "POST" });
  }, [fetcher]);

  const editProduct = products.find((p) => p.id === editingProduct);

  return (
    <s-page
      heading="Passeport Produit Digital (DPP)"
    >
      <s-button
        slot="primary-action"
        onClick={handleGenerateAll}
        {...(isGenerating ? { loading: true } : {})}
      >
        Générer tous les DPP
      </s-button>

      {/* Info banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
          border: "1px solid #bfdbfe",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
        >
          <span style={{ fontSize: 24 }}>{"\u{1F1EA}\u{1F1FA}"}</span>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1e40af",
                marginBottom: 4,
              }}
            >
              Préparez-vous à la réglementation EU 2027
            </div>
            <div
              style={{ fontSize: 13, color: "#3b82f6", lineHeight: 1.5 }}
            >
              Le Passeport Numérique Produit (ESPR 2024/1781) sera
              obligatoire dès 2027 pour le textile et progressivement pour
              d&#39;autres secteurs. Carboniq génère automatiquement les fiches
              environnementales conformes avec QR code vérifiable pour
              chacun de vos produits.
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "16px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}
          >
            {products.length}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Produits total
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "16px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}
          >
            {generated}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>DPP générés</div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            padding: "16px 20px",
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}
          >
            {products.length - generated}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>En attente</div>
        </div>
      </div>

      {/* Edit section — full DPP form with category selector */}
      {editingProduct && editProduct && (() => {
        const existingMats: Array<{ name: string; percentage: number; recycled: boolean }> = editProduct.dppMaterials ? (() => { try { return JSON.parse(editProduct.dppMaterials); } catch { return []; } })() : [];
        const initMats = existingMats.length > 0 ? existingMats : [{ name: "", percentage: 0, recycled: false }];

        // Detect category from categoryCode or selectedCategory
        const detectedCat = selectedCategory
          ?? (editProduct.categoryCode?.split(".")[0] ?? "generic");
        const catConfig = DPP_CATEGORIES.find((c) => c.code === detectedCat) ?? DPP_CATEGORIES[DPP_CATEGORIES.length - 1];
        const hasExtra = (f: string) => catConfig.extraFields.includes(f);

        return (
        <div style={{ background: "#fff", borderRadius: 14, border: "2px solid #6366f1", padding: 28, marginBottom: 20, boxShadow: "0 4px 20px rgba(99,102,241,0.1)" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Fiche DPP : {editProduct.title}</div>
            <button onClick={() => { setEditingProduct(null); setSelectedCategory(null); setMatRows(1); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7280" }}>{"\u2715"}</button>
          </div>

          {/* Category selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Catégorie du produit</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {DPP_CATEGORIES.map((c) => (
                <button key={c.code} type="button" onClick={() => setSelectedCategory(c.code)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "10px 6px", borderRadius: 10, fontSize: 11, fontWeight: 500,
                    border: detectedCat === c.code ? `2px solid ${c.color}` : "1px solid #e5e7eb",
                    background: detectedCat === c.code ? c.bg : "#fafafa",
                    color: detectedCat === c.code ? c.color : "#6b7280",
                    cursor: "pointer", transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span style={{ textAlign: "center", lineHeight: 1.2 }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <fetcher.Form method="POST">
            <input type="hidden" name="intent" value="update-dpp" />
            <input type="hidden" name="productId" value={editProduct.id} />

            {/* Section: Origine */}
            <SectionTitle icon="📍" text="Origine & fabrication" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <Field label="Pays de fabrication" name="origin" value={editProduct.dppOriginCountry} placeholder="France, Chine, Bangladesh..." />
              <Field label="Durée de vie estimée (années)" name="durability" value={editProduct.dppDurabilityYears?.toString()} placeholder="Ex: 3" type="number" />
            </div>

            {/* Section: Matériaux */}
            <SectionTitle icon={catConfig.code === "food" ? "🥘" : catConfig.code === "beauty" ? "🧴" : "🧵"} text="Composition" />
            <div style={{ marginBottom: 20 }}>
              {Array.from({ length: Math.max(initMats.length, matRows) }).map((_, i) => {
                const m = initMats[i] ?? { name: "", percentage: 0, recycled: false };
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 80px auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                    <div>
                      {i === 0 && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>{catConfig.code === "food" ? "Ingrédient / emballage" : catConfig.code === "beauty" ? "Ingrédient INCI" : "Matériau"}</label>}
                      <input name="mat_name" defaultValue={m.name} placeholder={catConfig.matPlaceholders[i % catConfig.matPlaceholders.length]}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      {i === 0 && <label htmlFor={`mat_pct_${i}`} style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>%</label>}
                      <input id={`mat_pct_${i}`} name="mat_pct" type="number" step="any" defaultValue={m.percentage > 0 ? m.percentage : ""}
                        placeholder="60" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280", cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input type="hidden" name="mat_recycled" value="false" />
                        <input type="checkbox" name="mat_recycled" value="true" defaultChecked={m.recycled} style={{ accentColor: "#16a34a" }} />
                        Recyclé
                      </label>
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={() => setMatRows((r) => r + 1)}
                style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: "4px 0" }}>
                + Ajouter un matériau
              </button>
            </div>

            {/* Section: Recyclabilité */}
            <SectionTitle icon="♻️" text="Recyclabilité & fin de vie" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <label htmlFor="dpp-recyclability" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Recyclabilité</label>
                <select id="dpp-recyclability" name="recyclability" defaultValue={editProduct.dppRecyclability ?? ""} style={selectStyle}>
                  <option value="">— Sélectionner —</option>
                  <option value="Entièrement recyclable">Entièrement recyclable</option>
                  <option value="Partiellement recyclable">Partiellement recyclable</option>
                  <option value="Non recyclable">Non recyclable</option>
                  <option value="Compostable industriel">Compostable (industriel)</option>
                  <option value="Compostable domestique">Compostable (domestique)</option>
                  <option value="Biodégradable">Biodégradable</option>
                  <option value="Consigné">Consigné / réutilisable</option>
                </select>
              </div>
              <div>
                <label htmlFor="dpp-endoflife" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Instructions fin de vie</label>
                <select id="dpp-endoflife" name="endoflife" defaultValue={editProduct.dppEndOfLife ?? ""} style={selectStyle}>
                  <option value="">— Sélectionner —</option>
                  {catConfig.endOfLifeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Section: Entretien */}
            <SectionTitle icon="🧼" text="Entretien & durabilité" />
            <div style={{ marginBottom: 20 }}>
              <Field label="Instructions d'entretien" name="care" value={editProduct.dppCareInstructions} placeholder={catConfig.carePlaceholder} textarea />
            </div>

            {/* Section: Certifications */}
            <SectionTitle icon="🏅" text="Certifications" />
            <div style={{ marginBottom: 8 }}>
              <Field label="Certifications obtenues" name="certifications" value={editProduct.dppCertifications} placeholder={catConfig.certOptions.slice(0, 3).join(", ")} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {catConfig.certOptions.map((cert) => (
                <span key={cert} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#f3f4f6", color: "#6b7280", cursor: "default" }}>{cert}</span>
              ))}
            </div>

            {/* Section: Électronique */}
            {hasExtra("repairability") && (
              <>
                <SectionTitle icon="🔧" text="Réparabilité (Électronique)" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <Field label="Indice de réparabilité (0-10)" name="repairability" value={editProduct.dppRepairabilityIdx?.toString()} placeholder="7.2" type="number" />
                  <Field label="Pièces détachées (années)" name="spareparts" value={editProduct.dppSparePartsYears?.toString()} placeholder="5" type="number" />
                  <div>
                    <label htmlFor="dpp-energyclass" style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>Classe énergie</label>
                    <select id="dpp-energyclass" name="energyclass" defaultValue={editProduct.dppEnergyClass ?? ""} style={selectStyle}>
                      <option value="">—</option>
                      {["A", "B", "C", "D", "E", "F", "G"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Section: Cosmétique */}
            {hasExtra("pao") && (
              <>
                <SectionTitle icon="🧴" text="Spécifique cosmétique" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <Field label="PAO — Période après ouverture (mois)" name="durability" value={editProduct.dppDurabilityYears ? (editProduct.dppDurabilityYears * 12).toString() : ""} placeholder="12" type="number" />
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", marginTop: 20, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked={editProduct.dppCertifications?.includes("Cruelty")} style={{ accentColor: "#9333ea" }} />
                      Non testé sur les animaux
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Section: Jouets */}
            {hasExtra("ageMinimum") && (
              <>
                <SectionTitle icon="🧸" text="Sécurité jouets" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  <Field label="Âge minimum recommandé" name="durability" value={editProduct.dppDurabilityYears?.toString()} placeholder="3" type="number" />
                  <div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", marginTop: 20, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: "#dc2626" }} />
                      Conforme CE / EN 71
                    </label>
                  </div>
                </div>
              </>
            )}

            <button type="submit" style={{
              padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: "none", cursor: "pointer", color: "white",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
              marginTop: 4,
            }}>
              Sauvegarder et régénérer le DPP
            </button>
          </fetcher.Form>
        </div>
        );
      })()}

      {/* Products table */}
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
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
            Fiches produit
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {[
                  "Produit",
                  "Catégorie",
                  "CO2",
                  "Impact",
                  "DPP",
                  "QR Code",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
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
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const cfg = p.carbonLabel
                  ? LABEL_COLORS[p.carbonLabel]
                  : null;
                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid #f9fafb" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 500,
                        color: "#111827",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.title}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          backgroundColor: "#f3f4f6",
                          color: "#6b7280",
                        }}
                      >
                        {p.categoryCode ?? "\u2014"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {p.carbonScoreKg != null
                        ? `${p.carbonScoreKg < 1 ? p.carbonScoreKg.toFixed(2) : p.carbonScoreKg.toFixed(1)} kg`
                        : "\u2014"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {cfg ? (
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            color: cfg.color,
                            backgroundColor: cfg.bg,
                          }}
                        >
                          {p.carbonLabel === "VERY_HIGH"
                            ? "Très élevé"
                            : p.carbonLabel === "HIGH"
                              ? "Élevé"
                              : p.carbonLabel === "MEDIUM"
                                ? "Modéré"
                                : "Faible"}
                        </span>
                      ) : (
                        "\u2014"
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {p.dppGeneratedAt ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            color: "#16a34a",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: "#16a34a",
                            }}
                          />
                          Généré
                        </span>
                      ) : (
                        <span
                          style={{ color: "#9ca3af", fontSize: 12 }}
                        >
                          En attente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {p.dppQrCodeUrl ? (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span
                            role="button"
                            tabIndex={0}
                            style={{ fontSize: 12, color: "#6366f1", cursor: "pointer", fontWeight: 500 }}
                            onClick={() => {
                              window.open(p.dppQrCodeUrl!, "_blank");
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") window.open(p.dppQrCodeUrl!, "_blank"); }}
                          >
                            Voir la fiche
                          </span>
                          <span style={{ color: "#d1d5db" }}>·</span>
                          <span
                            role="button"
                            tabIndex={0}
                            style={{ fontSize: 12, color: "#9ca3af", cursor: "pointer", fontWeight: 500 }}
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}${p.dppQrCodeUrl}`);
                              shopify.toast.show("Lien DPP copié !");
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { navigator.clipboard.writeText(`${window.location.origin}${p.dppQrCodeUrl}`); shopify.toast.show("Lien DPP copié !"); } }}
                          >
                            Copier
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "#d1d5db", fontSize: 12 }}>{"\u2014"}</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => setEditingProduct(p.id)}
                          style={{ fontSize: 12, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}
                        >
                          Modifier
                        </button>
                        {!p.dppGeneratedAt ? (
                          <fetcher.Form method="POST">
                            <input type="hidden" name="intent" value="generate-one" />
                            <input type="hidden" name="productId" value={p.id} />
                            <button
                              type="submit"
                              style={{ fontSize: 12, color: "#16a34a", background: "none", border: "none", cursor: "pointer", fontWeight: 500, padding: 0 }}
                            >
                              Générer
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
    </s-page>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 13, background: "#fff",
  boxSizing: "border-box",
};

function SectionTitle({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 6 }}>
      <span>{icon}</span> {text}
    </div>
  );
}

function Field({ label, name, value, placeholder, type, textarea }: {
  label?: string; name: string; value?: string | null; placeholder?: string; type?: string; textarea?: boolean;
}) {
  const style: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid #d1d5db", fontSize: 13, fontFamily: "inherit",
    background: "#fff", boxSizing: "border-box",
  };
  return (
    <div>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 4 }}>{label}</label>}
      {textarea ? (
        <textarea name={name} defaultValue={value ?? ""} placeholder={placeholder} rows={2} style={{ ...style, resize: "vertical" }} />
      ) : (
        <input name={name} type={type ?? "text"} defaultValue={value ?? ""} placeholder={placeholder} style={style} step={type === "number" ? "any" : undefined} />
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
