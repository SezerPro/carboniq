import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { PLANS, type PlanTier } from "../lib/plans/constants";
import { getPlanTier } from "../lib/plans/gates.server";
import { createSubscription, cancelSubscription, syncPlanFromShopify, getActiveSubscription } from "../lib/plans/billing.server";
import { BASE_CSS, INIT_SCRIPT, COLORS } from "../lib/ui/shared-styles";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session, admin } = await authenticate.admin(request);

    // Sync plan from Shopify on every load (catches approved/canceled subscriptions)
    await syncPlanFromShopify(admin, session.shop);

    const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
    const currentTier = getPlanTier(shop?.plan, shop?.planStatus);

    // Get active subscription info
    const activeSub = await getActiveSubscription(admin);

    return {
      currentTier,
      shopDomain: session.shop,
      activeSub: activeSub ? {
        name: activeSub.name,
        status: activeSub.status,
        trialDays: activeSub.trialDays,
      } : null,
    };
  } catch (error) {
    console.error("[app.pricing] Loader error:", error);
    return { error: true, message: "Erreur de chargement" };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const plan = formData.get("plan") as string;

  const shop = await db.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return { error: "Shop not found" };

  // ── Downgrade to Free ──
  if (intent === "downgrade" || plan === "FREE") {
    const activeSub = await getActiveSubscription(admin);
    if (activeSub) {
      await cancelSubscription(admin, activeSub.id);
    }
    await db.shop.update({
      where: { id: shop.id },
      data: { plan: "FREE", planStatus: "CANCELED" },
    });
    return { success: true, plan: "FREE" };
  }

  // ── Upgrade to paid plan ──
  if (intent === "upgrade" && (plan === "STARTER" || plan === "GROWTH" || plan === "PRO" || plan === "SCALE")) {
    // Return URL must point to the Shopify admin embedded app URL so the merchant
    // lands back inside the admin iframe with a valid session after approving.
    // Passing the raw Vercel URL would drop them on the unauthenticated login page.
    const storeHandle = session.shop.replace(".myshopify.com", "");
    const returnUrl = `https://admin.shopify.com/store/${storeHandle}/apps/${process.env.SHOPIFY_API_KEY}/app/pricing`;

    // Test charge is auto-detected by createSubscription based on store type
    // (dev store → test charge, production store → real charge).
    const result = await createSubscription(
      admin,
      plan as Exclude<PlanTier, "FREE">,
      session.shop,
      returnUrl,
    );

    if ("error" in result) {
      return { error: result.error };
    }

    // Redirect merchant to Shopify's confirmation page
    return { confirmationUrl: result.confirmationUrl };
  }

  return { error: "Action inconnue" };
};

const TIER_LEVEL: Record<string, number> = { FREE: 0, STARTER: 1, GROWTH: 2, PRO: 3, SCALE: 4 };

const PAGE_CSS = `
.cp *{box-sizing:border-box;margin:0;padding:0}
.cp{
  font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;color:#2C2825;
  max-width:1200px;margin:0 auto;
}
.cp::before{
  content:'';position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.3;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
  background-size:128px 128px;
}
.cp>*{position:relative;z-index:1}

@keyframes cpUp{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.cp-anim{opacity:0;animation:cpUp .6s cubic-bezier(.22,1,.36,1) forwards}

/* Current plan banner */
.cp-current{
  background:rgba(253,252,251,.7);backdrop-filter:blur(20px) saturate(1.4);
  -webkit-backdrop-filter:blur(20px) saturate(1.4);
  border:1px solid rgba(255,255,255,.6);border-radius:16px;
  padding:18px 28px;margin-bottom:20px;
  display:flex;align-items:center;justify-content:space-between;
  box-shadow:0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
}
.cp-current-plan{font-family:'Instrument Serif',Georgia,serif;font-size:22px;color:#2C2825;letter-spacing:-.02em}
.cp-current-badge{
  font-family:'DM Mono',monospace;font-size:11px;font-weight:600;
  padding:4px 12px;border-radius:99px;display:inline-flex;align-items:center;gap:5px;
}

/* Plans grid */
.cp-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}

/* Plan card */
.cp-card{
  background:rgba(253,252,251,.65);backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.5);border-radius:20px;
  padding:28px 22px 24px;position:relative;
  display:flex;flex-direction:column;
  transition:all .3s cubic-bezier(.22,1,.36,1);
  box-shadow:0 0 0 1px rgba(164,156,144,.05),0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
}
.cp-card:hover{
  transform:translateY(-4px);
  box-shadow:0 0 0 1px rgba(74,124,89,.08),0 4px 12px rgba(44,40,37,.06),0 16px 48px rgba(44,40,37,.08);
}

/* Recommended */
.cp-card--rec{
  border:2px solid rgba(74,124,89,.4);
  box-shadow:0 0 0 4px rgba(74,124,89,.06),0 4px 16px rgba(44,40,37,.06),0 16px 48px rgba(44,40,37,.08);
  background:rgba(253,252,251,.8);
}
.cp-card--rec:hover{border-color:#4A7C59}

/* Current */
.cp-card--cur{border:2px solid #2C2825;background:rgba(253,252,251,.85)}

/* Badge */
.cp-badge{
  position:absolute;top:-11px;left:50%;transform:translateX(-50%);
  font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  padding:4px 14px;border-radius:99px;white-space:nowrap;
}

/* Plan name */
.cp-name{font-size:17px;font-weight:700;color:#2C2825;margin-bottom:6px}

/* Price */
.cp-price{display:flex;align-items:baseline;gap:4px;margin-bottom:4px}
.cp-price-num{font-family:'Instrument Serif',Georgia,serif;font-size:40px;font-weight:400;color:#2C2825;letter-spacing:-.04em;line-height:1.1}
.cp-price-per{font-size:12px;color:#9C9488}

/* Description */
.cp-desc{font-size:12px;color:#9C9488;margin-bottom:18px;line-height:1.4}

/* Features */
.cp-features{list-style:none;padding:0;margin:0 0 20px;flex:1}
.cp-features li{
  font-size:12px;color:#3D3833;padding:4px 0;
  display:flex;align-items:flex-start;gap:7px;line-height:1.4;
}
.cp-features li::before{
  content:'';width:14px;height:14px;flex-shrink:0;margin-top:1px;
  background:rgba(74,124,89,.1);border-radius:50%;
  background-image:url("data:image/svg+xml,%3Csvg width='8' height='6' viewBox='0 0 8 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 3L3 5L7 1' stroke='%234A7C59' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:center;
}

/* Button */
.cp-btn{
  width:100%;padding:11px;border-radius:12px;font-size:13px;font-weight:600;
  cursor:pointer;border:none;font-family:'DM Sans',sans-serif;
  transition:all .2s cubic-bezier(.22,1,.36,1);
}
.cp-btn--brand{
  background:#4A7C59;color:#fff;
  box-shadow:0 2px 8px rgba(74,124,89,.25);
}
.cp-btn--brand:hover{background:#3A6E24;transform:translateY(-1px);box-shadow:0 4px 16px rgba(74,124,89,.3)}
.cp-btn--dark{
  background:#2C2825;color:#FDFCFB;
  box-shadow:0 2px 8px rgba(44,40,37,.15);
}
.cp-btn--dark:hover{background:#1E1B18;transform:translateY(-1px);box-shadow:0 4px 16px rgba(44,40,37,.2)}
.cp-btn--ghost{
  background:transparent;color:#9C9488;
  border:1px solid rgba(164,156,144,.2);
}
.cp-btn--ghost:hover{background:rgba(164,156,144,.06);color:#2C2825;border-color:rgba(164,156,144,.3)}
.cp-btn--cur{background:#2C2825;color:#FDFCFB;cursor:default;opacity:.7}
.cp-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}

/* Limits */
.cp-limits{font-family:'DM Mono',monospace;font-size:10px;color:#B8B0A6;text-align:center;margin-top:8px}

/* FAQ */
.cp-faq{
  background:rgba(253,252,251,.65);backdrop-filter:blur(16px) saturate(1.3);
  -webkit-backdrop-filter:blur(16px) saturate(1.3);
  border:1px solid rgba(255,255,255,.5);border-radius:20px;padding:28px;
  box-shadow:0 1px 3px rgba(44,40,37,.04),0 4px 16px rgba(44,40,37,.04);
}
.cp-faq-title{font-size:15px;font-weight:700;color:#2C2825;margin-bottom:18px}
.cp-faq-item{padding:14px 0;border-bottom:1px solid rgba(164,156,144,.08)}
.cp-faq-item:last-child{border-bottom:none;padding-bottom:0}
.cp-faq-q{font-size:13px;font-weight:600;color:#2C2825;margin-bottom:4px}
.cp-faq-a{font-size:12.5px;color:#7A746C;line-height:1.5}

/* Stagger */
.cp-grid .cp-card:nth-child(1){animation-delay:.03s}
.cp-grid .cp-card:nth-child(2){animation-delay:.06s}
.cp-grid .cp-card:nth-child(3){animation-delay:.09s}
.cp-grid .cp-card:nth-child(4){animation-delay:.12s}
.cp-grid .cp-card:nth-child(5){animation-delay:.15s}

@media(max-width:1200px){.cp-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.cp-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.cp-grid{grid-template-columns:1fr}}
`;

export default function Pricing() {
  const data = useLoaderData<typeof loader>();
  // Hooks must run unconditionally, before any early return (rules-of-hooks).
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.data && "confirmationUrl" in fetcher.data) {
      open(fetcher.data.confirmationUrl as string, "_top");
    }
    if (fetcher.data && "success" in fetcher.data) {
      shopify.toast.show("Plan mis à jour !");
    }
    if (fetcher.data && "error" in fetcher.data) {
      shopify.toast.show(`Erreur : ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  if ("error" in data) return <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted }}>Erreur de chargement. Rechargez la page.</div>;
  const { currentTier } = data;
  const isChanging = fetcher.state !== "idle";

  const handleSelect = (tier: PlanTier) => {
    if (tier === currentTier) return;
    if (tier === "FREE") {
      fetcher.submit({ intent: "downgrade", plan: "FREE" }, { method: "POST" });
    } else {
      fetcher.submit({ intent: "upgrade", plan: tier }, { method: "POST" });
    }
  };

  const tierName = (t: string) => t === "FREE" ? "Free" : t === "STARTER" ? "Starter" : t === "GROWTH" ? "Growth" : t === "PRO" ? "Pro" : "Scale";

  return (
    <s-page heading="Choisir votre plan">
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS + PAGE_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: INIT_SCRIPT }} />

      <div className="cp">

        {/* Current plan banner */}
        <div className="cp-current cp-anim">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>Plan actuel</span>
            <span className="cp-current-plan">{tierName(currentTier)}</span>
          </div>
          <span className="cp-current-badge" style={{
            background: currentTier === "FREE" ? "rgba(164,156,144,.1)" : "rgba(74,124,89,.1)",
            color: currentTier === "FREE" ? COLORS.textMuted : "#15803D",
            border: `1px solid ${currentTier === "FREE" ? "rgba(164,156,144,.15)" : "rgba(74,124,89,.15)"}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
            {currentTier === "FREE" ? "Gratuit" : "Actif"}
          </span>
        </div>

        {/* Plans grid */}
        <div className="cp-grid">
          {PLANS.map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const isUpgrade = TIER_LEVEL[plan.tier] > TIER_LEVEL[currentTier];
            const isDowngrade = TIER_LEVEL[plan.tier] < TIER_LEVEL[currentTier];
            const isRec = plan.badge === "Recommande" || plan.badge === "Recommandé";

            return (
              <div key={plan.tier} className={`cp-card cp-anim ${isRec ? "cp-card--rec" : ""} ${isCurrent ? "cp-card--cur" : ""}`}>
                {plan.badge && !isCurrent && (
                  <div className="cp-badge" style={{
                    background: isRec ? COLORS.green : COLORS.dark, color: "#FDFCFB",
                  }}>{plan.badge}</div>
                )}
                {isCurrent && (
                  <div className="cp-badge" style={{ background: COLORS.dark, color: "#FDFCFB" }}>Plan actuel</div>
                )}

                <div className="cp-name">{plan.name}</div>
                <div className="cp-price">
                  <span className="cp-price-num">{plan.price}</span>
                  <span className="cp-price-per">{plan.period}</span>
                </div>
                <div className="cp-desc">{plan.description}</div>

                <ul className="cp-features">
                  {plan.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>

                <button
                  className={`cp-btn ${isCurrent ? "cp-btn--cur" : isRec ? "cp-btn--brand" : isUpgrade ? "cp-btn--dark" : "cp-btn--ghost"}`}
                  onClick={() => handleSelect(plan.tier)}
                  disabled={isCurrent || isChanging}
                >
                  {isCurrent ? "Plan actuel" : isDowngrade ? "Rétrograder" : plan.cta}
                </button>

                <div className="cp-limits">{plan.limits}</div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="cp-faq cp-anim" style={{ animationDelay: ".2s" }}>
          <div className="cp-faq-title">Questions fréquentes</div>
          {[
            { q: "Puis-je changer de plan à tout moment ?", a: "Oui, vous pouvez upgrader ou rétrograder à tout moment. Le changement prend effet immédiatement." },
            { q: "Y a-t-il un engagement ?", a: "Non, tous les plans sont sans engagement. Vous pouvez annuler à tout moment." },
            { q: "Comment fonctionne la facturation ?", a: "Le paiement est géré directement par Shopify sur votre facture habituelle. Pas besoin d'entrer une carte bancaire supplémentaire." },
            { q: "Que se passe-t-il si je dépasse la limite de produits ?", a: "Les produits existants restent scorés. Les nouveaux produits ne seront pas analysés tant que vous n'aurez pas upgradé." },
            { q: "Le DPP est-il obligatoire ?", a: "Le Passeport Numérique Produit sera obligatoire en EU dès 2027 pour le textile. Nous recommandons de vous préparer dès maintenant avec le plan Growth." },
          ].map((faq, i) => (
            <div key={i} className="cp-faq-item">
              <div className="cp-faq-q">{faq.q}</div>
              <div className="cp-faq-a">{faq.a}</div>
            </div>
          ))}
        </div>

      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
