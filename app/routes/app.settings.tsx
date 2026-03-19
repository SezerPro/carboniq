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
import { encrypt } from "../lib/security/api-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { shop: null };

  return {
    shop: {
      shopDomain: shop.shopDomain,
      name: shop.name,
      email: shop.email,
      plan: shop.plan,
      planStatus: shop.planStatus,
      badgeStyle: shop.badgeStyle,
      badgeColor: shop.badgeColor,
      badgePosition: shop.badgePosition,
      showLabel: shop.showLabel,
      showComparison: shop.showComparison,
      showSocialProof: shop.showSocialProof,
      enableOffset: shop.enableOffset,
      enableTrees: shop.enableTrees,
      enableOcean: shop.enableOcean,
      treeCostEur: shop.treeCostEur,
      oceanCostEur: shop.oceanCostEur,
      carbonCostEur: shop.carbonCostEur,
      klaviyoApiKey: shop.klaviyoApiKey ? "••••••••" : null,
      klaviyoListId: shop.klaviyoListId,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { error: "Shop not found" };

  const updates: Record<string, any> = {};

  // Badge settings
  const badgeStyle = formData.get("badgeStyle");
  if (badgeStyle) updates.badgeStyle = badgeStyle;

  const badgePosition = formData.get("badgePosition");
  if (badgePosition) updates.badgePosition = badgePosition as string;

  const showLabel = formData.get("showLabel");
  if (showLabel !== null) updates.showLabel = showLabel === "true";

  const showComparison = formData.get("showComparison");
  if (showComparison !== null) updates.showComparison = showComparison === "true";

  const showSocialProof = formData.get("showSocialProof");
  if (showSocialProof !== null) updates.showSocialProof = showSocialProof === "true";

  // Offset settings
  const enableOffset = formData.get("enableOffset");
  if (enableOffset !== null) updates.enableOffset = enableOffset === "true";

  // Multi-impact
  const enableTrees = formData.get("enableTrees");
  if (enableTrees !== null) updates.enableTrees = enableTrees === "true";

  const enableOcean = formData.get("enableOcean");
  if (enableOcean !== null) updates.enableOcean = enableOcean === "true";

  // Klaviyo
  const klaviyoApiKey = formData.get("klaviyoApiKey") as string | null;
  if (klaviyoApiKey && klaviyoApiKey !== "••••••••") updates.klaviyoApiKey = encrypt(klaviyoApiKey);

  const klaviyoListId = formData.get("klaviyoListId") as string | null;
  if (klaviyoListId) updates.klaviyoListId = klaviyoListId;

  if (Object.keys(updates).length > 0) {
    await db.shop.update({ where: { id: shop.id }, data: updates });
  }

  return { success: true };
};

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  if (!shop) {
    return (
      <s-page heading="Paramètres" backAction={{ url: "/app" }}>
        <s-section><s-paragraph>Boutique non trouvée.</s-paragraph></s-section>
      </s-page>
    );
  }

  const isSaving = fetcher.state !== "idle";

  return (
    <s-page heading="Paramètres" backAction={{ url: "/app" }}>

      {/* Badge Settings */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎨</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Apparence du badge</span>
        </div>
        <fetcher.Form method="POST" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FieldGroup label="Style du badge">
              <select name="badgeStyle" defaultValue={shop.badgeStyle}
                style={selectStyle}>
                <option value="PILL">Pill (arrondi)</option>
                <option value="LEAF">Leaf (bordure)</option>
                <option value="MINIMAL">Minimal</option>
                <option value="DETAILED">Détaillé</option>
              </select>
            </FieldGroup>

            <FieldGroup label="Position">
              <select name="badgePosition" defaultValue={shop.badgePosition}
                style={selectStyle}>
                <option value="below_price">Sous le prix</option>
                <option value="below_title">Sous le titre</option>
                <option value="below_description">Sous la description</option>
              </select>
            </FieldGroup>

            <ToggleField name="showLabel" label="Afficher le texte du label" defaultChecked={shop.showLabel} />
            <ToggleField name="showComparison" label="Afficher les équivalences" defaultChecked={shop.showComparison} />
            <ToggleField name="showSocialProof" label="Afficher la preuve sociale" defaultChecked={shop.showSocialProof} />
          </div>
          <button type="submit" disabled={isSaving} style={btnStyle}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </fetcher.Form>
      </div>

      {/* Offset Settings */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>♻️</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Compensation carbone</span>
        </div>
        <fetcher.Form method="POST" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <ToggleField name="enableOffset" label="Activer l'offset au checkout" defaultChecked={shop.enableOffset} />
            <ToggleField name="enableTrees" label="Planter des arbres par commande" defaultChecked={shop.enableTrees} />
            <ToggleField name="enableOcean" label="Nettoyage plastique océan" defaultChecked={shop.enableOcean} />
          </div>
          <button type="submit" disabled={isSaving} style={btnStyle}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </fetcher.Form>
      </div>

      {/* Klaviyo Integration */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📧</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Intégration Klaviyo</span>
        </div>
        <fetcher.Form method="POST" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FieldGroup label="Clé API Klaviyo">
              <input type="text" name="klaviyoApiKey"
                defaultValue={shop.klaviyoApiKey ?? ""}
                placeholder="pk_xxxxx..."
                style={inputStyle} />
            </FieldGroup>
            <FieldGroup label="ID de liste">
              <input type="text" name="klaviyoListId"
                defaultValue={shop.klaviyoListId ?? ""}
                placeholder="AbCdEf"
                style={inputStyle} />
            </FieldGroup>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, marginBottom: 16 }}>
            Connectez Klaviyo pour segmenter vos clients éco-responsables et envoyer des emails ciblés.
          </div>
          <button type="submit" disabled={isSaving} style={btnStyle}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </fetcher.Form>
      </div>

      {/* Plan info */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>💎</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>Abonnement</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{
              padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              color: "#6366f1", backgroundColor: "#eef2ff",
            }}>
              {shop.plan}
            </span>
            <span style={{
              padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              color: shop.planStatus === "ACTIVE" || shop.planStatus === "TRIALING" ? "#16a34a" : "#dc2626",
              backgroundColor: shop.planStatus === "ACTIVE" || shop.planStatus === "TRIALING" ? "#dcfce7" : "#fee2e2",
            }}>
              {shop.planStatus === "TRIALING" ? "Essai gratuit" : shop.planStatus === "ACTIVE" ? "Actif" : shop.planStatus}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Boutique : {shop.shopDomain}
          </div>
        </div>
      </div>
    </s-page>
  );
}

// ── Shared styles & components ─────────────────────────

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 13,
  backgroundColor: "#fff", color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid #d1d5db", fontSize: 13,
  backgroundColor: "#fff", color: "#374151",
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  marginTop: 16, padding: "10px 20px", borderRadius: 8,
  background: "linear-gradient(135deg, #4f46e5, #6366f1)",
  color: "#fff", fontSize: 13, fontWeight: 600,
  border: "none", cursor: "pointer",
  boxShadow: "0 1px 3px rgba(99,102,241,0.3)",
};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ToggleField({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked}
        style={{ width: 18, height: 18, accentColor: "#6366f1", cursor: "pointer" }} />
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
    </label>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
