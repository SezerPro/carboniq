import { useCallback, useState } from "react";
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

  if (intent === "update-materials") {
    const productId = formData.get("productId") as string;
    const materials = formData.get("materials") as string;
    const origin = formData.get("origin") as string;
    const recyclability = formData.get("recyclability") as string;

    if (!productId) return { error: "productId manquant" };

    await db.product.update({
      where: { id: productId },
      data: {
        dppMaterials: materials || null,
        dppOriginCountry: origin || null,
        dppRecyclability: recyclability || null,
      },
    });

    // Regenerate DPP with updated data
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

// -- Component --

export default function DPP() {
  const { products, shopDomain } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [editingProduct, setEditingProduct] = useState<string | null>(null);

  const isGenerating = fetcher.state !== "idle";
  const generated = products.filter((p) => p.dppGeneratedAt).length;

  const handleGenerateAll = useCallback(() => {
    fetcher.submit({ intent: "generate-all" }, { method: "POST" });
  }, [fetcher]);

  const editProduct = products.find((p) => p.id === editingProduct);

  return (
    <s-page
      heading="Passeport Produit Digital (DPP)"
      backAction={{ url: "/app" }}
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
              d'autres secteurs. Carboniq génère automatiquement les fiches
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

      {/* Edit section */}
      {editingProduct && editProduct && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            border: "2px solid #6366f1",
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}
            >
              Modifier DPP : {editProduct.title}
            </div>
            <button
              onClick={() => setEditingProduct(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                color: "#6b7280",
              }}
            >
              {"\u2715"}
            </button>
          </div>
          <fetcher.Form method="POST">
            <input type="hidden" name="intent" value="update-materials" />
            <input
              type="hidden"
              name="productId"
              value={editProduct.id}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 16,
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
                  Pays d'origine
                </label>
                <input
                  name="origin"
                  defaultValue={editProduct.dppOriginCountry ?? ""}
                  placeholder="Ex: France, Chine, Italie..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
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
                  Recyclabilité
                </label>
                <input
                  name="recyclability"
                  defaultValue={editProduct.dppRecyclability ?? ""}
                  placeholder="Ex: Recyclable, Non recyclable..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 4,
                }}
              >
                Matériaux (JSON)
              </label>
              <textarea
                name="materials"
                defaultValue={editProduct.dppMaterials ?? ""}
                placeholder='[{"name":"Coton","percentage":60,"recycled":false},{"name":"Polyester","percentage":40,"recycled":true}]'
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  fontFamily: "monospace",
                  resize: "vertical",
                }}
              />
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Format JSON : [{"{"}name, percentage, recycled{"}"}]
              </div>
            </div>
            <button
              type="submit"
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                color: "white",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              }}
            >
              Sauvegarder et régénérer le DPP
            </button>
          </fetcher.Form>
        </div>
      )}

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
                  "CO\u2082",
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
                        <span
                          style={{
                            fontSize: 12,
                            color: "#6366f1",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}${p.dppQrCodeUrl}`,
                            );
                            shopify.toast.show("Lien DPP copié !");
                          }}
                        >
                          Copier le lien
                        </span>
                      ) : (
                        <span style={{ color: "#d1d5db", fontSize: 12 }}>
                          \u2014
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <button
                          onClick={() => setEditingProduct(p.id)}
                          style={{
                            fontSize: 12,
                            color: "#6366f1",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 500,
                            padding: 0,
                          }}
                        >
                          Modifier
                        </button>
                        {!p.dppGeneratedAt && (
                          <fetcher.Form method="POST">
                            <input
                              type="hidden"
                              name="intent"
                              value="generate-one"
                            />
                            <input
                              type="hidden"
                              name="productId"
                              value={p.id}
                            />
                            <button
                              type="submit"
                              style={{
                                fontSize: 12,
                                color: "#16a34a",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: 500,
                                padding: 0,
                              }}
                            >
                              Générer
                            </button>
                          </fetcher.Form>
                        )}
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
