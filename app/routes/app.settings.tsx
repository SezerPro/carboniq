import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { encrypt } from "../lib/security/api-auth.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
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
        locale: shop.locale,
      },
    };
  } catch (error) {
    console.error("[app.settings] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { error: "Shop not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Locale
  const locale = formData.get("locale") as string | null;
  if (locale) updates.locale = locale;

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

// ── CSS ──

const PAGE_CSS = `
.cs *{box-sizing:border-box;margin:0;padding:0}
.cs{
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;
  color:#2C2825;max-width:720px;margin:0 auto;
}

/* Grain */
.cs::before{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.3;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  background-size:128px 128px;
}
.cs>*{position:relative;z-index:1}

@keyframes csUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.cs-anim{opacity:0;animation:csUp .6s cubic-bezier(.22,1,.36,1) forwards}

/* Section card */
.cs-card{
  background:rgba(253,252,251,.7);
  backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid rgba(255,255,255,.6);
  border-radius:20px;
  box-shadow:0 0 0 1px rgba(164,156,144,.06),0 1px 2px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04),0 12px 48px rgba(44,40,37,.06);
  margin-bottom:16px;overflow:hidden;
  transition:box-shadow .3s ease;
}
.cs-card:hover{box-shadow:0 0 0 1px rgba(74,124,89,.08),0 2px 4px rgba(44,40,37,.06),0 8px 24px rgba(44,40,37,.06),0 16px 48px rgba(44,40,37,.07)}

.cs-card-head{
  padding:18px 24px;
  border-bottom:1px solid rgba(164,156,144,.08);
  display:flex;align-items:center;gap:12px;
}
.cs-card-icon{
  width:32px;height:32px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-size:15px;flex-shrink:0;
}
.cs-card-title{font-size:14px;font-weight:700;color:#2C2825}
.cs-card-desc{font-size:11px;color:#9C9488;margin-top:1px}
.cs-card-body{padding:24px}

/* Grid */
.cs-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:600px){.cs-grid{grid-template-columns:1fr}}

/* Field */
.cs-field{margin-bottom:0}
.cs-field-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9C9488;margin-bottom:6px}
.cs-field-hint{font-size:11px;color:#B8B0A6;margin-top:6px;line-height:1.4}

/* Select */
.cs-select{
  width:100%;padding:10px 14px;border-radius:12px;
  border:1px solid rgba(164,156,144,.15);
  background:rgba(253,252,251,.8);
  font-family:'DM Sans',sans-serif;font-size:13px;color:#2C2825;
  appearance:none;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239C9488' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;
  transition:all .2s ease;
}
.cs-select:focus{outline:none;border-color:rgba(74,124,89,.4);box-shadow:0 0 0 3px rgba(74,124,89,.1)}
.cs-select:hover{border-color:rgba(74,124,89,.25)}

/* Input */
.cs-input{
  width:100%;padding:10px 14px;border-radius:12px;
  border:1px solid rgba(164,156,144,.15);
  background:rgba(253,252,251,.8);
  font-family:'DM Mono',monospace;font-size:13px;color:#2C2825;
  transition:all .2s ease;box-sizing:border-box;
}
.cs-input::placeholder{color:#C4BDB2}
.cs-input:focus{outline:none;border-color:rgba(74,124,89,.4);box-shadow:0 0 0 3px rgba(74,124,89,.1)}

/* Custom toggle */
.cs-toggle{display:flex;align-items:center;gap:12px;cursor:pointer;padding:8px 0}
.cs-toggle input[type="checkbox"]{display:none}
.cs-toggle-track{
  width:40px;height:22px;border-radius:99px;position:relative;flex-shrink:0;
  background:rgba(164,156,144,.2);border:1px solid rgba(164,156,144,.1);
  transition:all .25s cubic-bezier(.22,1,.36,1);
}
.cs-toggle-track::after{
  content:'';position:absolute;top:2px;left:2px;
  width:16px;height:16px;border-radius:50%;
  background:#fff;
  box-shadow:0 1px 3px rgba(44,40,37,.15);
  transition:all .25s cubic-bezier(.22,1,.36,1);
}
.cs-toggle input:checked+.cs-toggle-track{background:#4A7C59;border-color:rgba(74,124,89,.3)}
.cs-toggle input:checked+.cs-toggle-track::after{transform:translateX(18px);box-shadow:0 1px 3px rgba(74,124,89,.3)}
.cs-toggle-label{font-size:13px;color:#3D3833;line-height:1.3}

/* Button */
.cs-btn{
  margin-top:20px;padding:10px 24px;border-radius:12px;
  background:#2C2825;color:#FDFCFB;
  font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
  border:none;cursor:pointer;
  transition:all .2s cubic-bezier(.22,1,.36,1);
  box-shadow:0 1px 3px rgba(44,40,37,.1),0 4px 12px rgba(44,40,37,.08);
}
.cs-btn:hover{background:#1E1B18;transform:translateY(-1px);box-shadow:0 2px 6px rgba(44,40,37,.12),0 8px 24px rgba(44,40,37,.1)}
.cs-btn:active{transform:translateY(0)}
.cs-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

/* Plan badge */
.cs-plan-badge{
  display:inline-flex;align-items:center;gap:6px;
  font-family:'DM Mono',monospace;font-size:13px;font-weight:600;
  padding:5px 14px;border-radius:10px;
}
.cs-plan-active{background:rgba(74,124,89,.1);color:#15803D;border:1px solid rgba(74,124,89,.15)}
.cs-plan-inactive{background:rgba(185,28,28,.08);color:#B91C1C;border:1px solid rgba(185,28,28,.1)}
.cs-plan-name{
  font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;
  letter-spacing:-.02em;color:#2C2825;margin-bottom:8px;
}
.cs-plan-domain{font-family:'DM Mono',monospace;font-size:12px;color:#B8B0A6;margin-top:8px}

/* Stagger */
.cs-card:nth-child(1){animation-delay:.03s}
.cs-card:nth-child(2){animation-delay:.06s}
.cs-card:nth-child(3){animation-delay:.09s}
.cs-card:nth-child(4){animation-delay:.12s}
.cs-card:nth-child(5){animation-delay:.15s}
`;

// ── Component ──

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  if (!shop) {
    return (
      <s-page heading="Paramètres">
        <s-section><s-paragraph>Boutique non trouvée.</s-paragraph></s-section>
      </s-page>
    );
  }

  const isSaving = fetcher.state !== "idle";

  return (
    <s-page heading="Paramètres">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="cs">

        {/* ── Language ── */}
        <div className="cs-card cs-anim">
          <div className="cs-card-head">
            <div className="cs-card-icon" style={{ background: COLORS.tealLight, color: COLORS.teal }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            </div>
            <div>
              <div className="cs-card-title">Langue</div>
              <div className="cs-card-desc">Langue de l&rsquo;interface du widget</div>
            </div>
          </div>
          <fetcher.Form method="POST" className="cs-card-body">
            <div className="cs-field">
              <div className="cs-field-label">Langue de l&rsquo;interface</div>
              <select name="locale" defaultValue={shop.locale ?? "auto"} className="cs-select">
                <option value="auto">Automatique (navigateur)</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
                <option value="pt">Português</option>
                <option value="it">Italiano</option>
                <option value="nl">Nederlands</option>
                <option value="ja">日本語</option>
              </select>
              <div className="cs-field-hint">En mode automatique, la langue est ddétectée depuis le navigateur du client.</div>
            </div>
            <button type="submit" disabled={isSaving} className="cs-btn">
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </fetcher.Form>
        </div>

        {/* ── Badge ── */}
        <div className="cs-card cs-anim">
          <div className="cs-card-head">
            <div className="cs-card-icon" style={{ background: COLORS.greenLight, color: COLORS.green }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            </div>
            <div>
              <div className="cs-card-title">Apparence du badge</div>
              <div className="cs-card-desc">Style, position et options d&rsquo;affichage</div>
            </div>
          </div>
          <fetcher.Form method="POST" className="cs-card-body">
            <div className="cs-grid">
              <div className="cs-field">
                <div className="cs-field-label">Style</div>
                <select name="badgeStyle" defaultValue={shop.badgeStyle} className="cs-select">
                  <option value="PILL">Pill (arrondi)</option>
                  <option value="LEAF">Leaf (feuille)</option>
                  <option value="MINIMAL">Minimal</option>
                  <option value="DETAILED">Détaillé</option>
                </select>
              </div>
              <div className="cs-field">
                <div className="cs-field-label">Position</div>
                <select name="badgePosition" defaultValue={shop.badgePosition} className="cs-select">
                  <option value="below_price">Sous le prix</option>
                  <option value="below_title">Sous le titre</option>
                  <option value="below_description">Sous la description</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <CsToggle name="showLabel" label="Afficher le texte du label" defaultChecked={shop.showLabel} />
              <CsToggle name="showComparison" label="Afficher les équivalences CO₂" defaultChecked={shop.showComparison} />
              <CsToggle name="showSocialProof" label="Afficher la preuve sociale" defaultChecked={shop.showSocialProof} />
            </div>
            <button type="submit" disabled={isSaving} className="cs-btn">
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </fetcher.Form>
        </div>

        {/* ── Offset ── */}
        <div className="cs-card cs-anim">
          <div className="cs-card-head">
            <div className="cs-card-icon" style={{ background: "rgba(45,134,89,.08)", color: "#2D8659" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 9-8 9z"/></svg>
            </div>
            <div>
              <div className="cs-card-title">Compensation carbone</div>
              <div className="cs-card-desc">Offset, arbres et nettoyage océan</div>
            </div>
          </div>
          <fetcher.Form method="POST" className="cs-card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <CsToggle name="enableOffset" label="Activer l&rsquo;offset carbone au checkout" defaultChecked={shop.enableOffset} />
              <CsToggle name="enableTrees" label="Planter des arbres par commande" defaultChecked={shop.enableTrees} />
              <CsToggle name="enableOcean" label="Nettoyage plastique océan" defaultChecked={shop.enableOcean} />
            </div>
            <button type="submit" disabled={isSaving} className="cs-btn">
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </fetcher.Form>
        </div>

        {/* ── Klaviyo ── */}
        <div className="cs-card cs-anim">
          <div className="cs-card-head">
            <div className="cs-card-icon" style={{ background: COLORS.blueLight, color: COLORS.blue }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <div>
              <div className="cs-card-title">Intégration Klaviyo</div>
              <div className="cs-card-desc">Segmentation clients éco-responsables</div>
            </div>
          </div>
          <fetcher.Form method="POST" className="cs-card-body">
            <div className="cs-grid">
              <div className="cs-field">
                <div className="cs-field-label">Clé API</div>
                <input type="text" name="klaviyoApiKey" defaultValue={shop.klaviyoApiKey ?? ""} placeholder="pk_xxxxx…" className="cs-input" />
              </div>
              <div className="cs-field">
                <div className="cs-field-label">ID de liste</div>
                <input type="text" name="klaviyoListId" defaultValue={shop.klaviyoListId ?? ""} placeholder="AbCdEf" className="cs-input" />
              </div>
            </div>
            <div className="cs-field-hint" style={{ marginTop: 10 }}>
              Connectez Klaviyo pour envoyer des emails ciblés à vos clients éco-responsables.
            </div>
            <button type="submit" disabled={isSaving} className="cs-btn">
              {isSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </fetcher.Form>
        </div>

        {/* ── Plan info ── */}
        <div className="cs-card cs-anim">
          <div className="cs-card-head">
            <div className="cs-card-icon" style={{ background: "rgba(150,114,45,.08)", color: "#96722D" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
            </div>
            <div>
              <div className="cs-card-title">Abonnement</div>
              <div className="cs-card-desc">Votre plan et statut actuel</div>
            </div>
          </div>
          <div className="cs-card-body">
            <div className="cs-plan-name">{shop.plan.charAt(0) + shop.plan.slice(1).toLowerCase()}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`cs-plan-badge ${shop.planStatus === "ACTIVE" || shop.planStatus === "TRIALING" ? "cs-plan-active" : "cs-plan-inactive"}`}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                {shop.planStatus === "TRIALING" ? "Essai gratuit" : shop.planStatus === "ACTIVE" ? "Actif" : shop.planStatus}
              </span>
            </div>
            <div className="cs-plan-domain">{shop.shopDomain}</div>
          </div>
        </div>

      </div>
    </s-page>
  );
}

// ── Toggle component ──

function CsToggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="cs-toggle">
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} />
      <span className="cs-toggle-track" />
      <span className="cs-toggle-label">{label}</span>
    </label>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
