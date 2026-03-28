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

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
      data: { plan: "STARTER", planStatus: "CANCELED" },
    });
    return { success: true, plan: "FREE" };
  }

  // ── Upgrade to paid plan ──
  if (intent === "upgrade" && (plan === "STARTER" || plan === "GROWTH" || plan === "PRO" || plan === "SCALE")) {
    // Build the return URL (merchant comes back here after approving)
    const url = new URL(request.url);
    const returnUrl = `${url.origin}/app/pricing`;

    const result = await createSubscription(
      admin,
      plan as Exclude<PlanTier, "FREE">,
      session.shop,
      returnUrl,
      process.env.NODE_ENV !== "production", // test in dev, real billing in prod
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

export default function Pricing() {
  const { currentTier } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const isChanging = fetcher.state !== "idle";

  // Handle redirect to Shopify confirmation page
  useEffect(() => {
    if (fetcher.data && "confirmationUrl" in fetcher.data) {
      // Redirect to Shopify's billing approval page
      open(fetcher.data.confirmationUrl as string, "_top");
    }
    if (fetcher.data && "success" in fetcher.data) {
      shopify.toast.show("Plan mis à jour !");
    }
    if (fetcher.data && "error" in fetcher.data) {
      shopify.toast.show(`Erreur : ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  const handleSelect = (tier: PlanTier) => {
    if (tier === currentTier) return;
    if (tier === "FREE") {
      fetcher.submit({ intent: "downgrade", plan: "FREE" }, { method: "POST" });
    } else {
      fetcher.submit({ intent: "upgrade", plan: tier }, { method: "POST" });
    }
  };

  return (
    <s-page heading="Choisir votre plan">
      <style dangerouslySetInnerHTML={{ __html: `
        .cq-pricing-wrap{width:100%;max-width:100%;margin:0 auto}
        .cq-pricing{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:24px}
        .cq-plan{background:#fdfcfb;border-radius:18px;border:1px solid rgba(164,156,144,.18);padding:28px 24px;position:relative;transition:all .2s ease;display:flex;flex-direction:column}
        .cq-plan:hover{box-shadow:0 8px 32px rgba(26,22,18,.1);transform:translateY(-2px)}
        .cq-plan-rec{border:2px solid #4a8a32;box-shadow:0 0 0 4px rgba(74,138,50,.1)}
        .cq-plan-current{border:2px solid #6366f1;background:#faf5ff}
        .cq-plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:600;padding:4px 14px;border-radius:999px;white-space:nowrap}
        .cq-plan-name{font-size:18px;font-weight:700;color:#1a1612;margin-bottom:4px}
        .cq-plan-price{display:flex;align-items:baseline;gap:4px;margin-bottom:4px}
        .cq-plan-price-num{font-family:'Instrument Serif',Georgia,serif;font-size:42px;font-weight:400;color:#1a1612;letter-spacing:-.03em;line-height:1}
        .cq-plan-price-per{font-size:13px;color:#a09890}
        .cq-plan-desc{font-size:13px;color:#7d756c;margin-bottom:20px;line-height:1.4}
        .cq-plan-features{list-style:none;padding:0;margin:0 0 24px;flex:1}
        .cq-plan-features li{font-size:12.5px;color:#413c36;padding:5px 0;display:flex;align-items:flex-start;gap:8px;line-height:1.4}
        .cq-plan-features li::before{content:'✓';color:#4a8a32;font-weight:700;font-size:13px;flex-shrink:0}
        .cq-plan-btn{width:100%;padding:11px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;border:none;transition:all .15s ease;font-family:inherit}
        .cq-plan-btn-primary{background:#1a1612;color:#fdfcfb;box-shadow:0 2px 8px rgba(26,22,18,.2)}
        .cq-plan-btn-primary:hover{background:#2d2520;transform:translateY(-1px);box-shadow:0 4px 16px rgba(26,22,18,.3)}
        .cq-plan-btn-brand{background:#4a8a32;color:#fff;box-shadow:0 2px 8px rgba(74,138,50,.3)}
        .cq-plan-btn-brand:hover{background:#3a6e24;transform:translateY(-1px);box-shadow:0 4px 16px rgba(74,138,50,.4)}
        .cq-plan-btn-ghost{background:transparent;color:#7d756c;border:1px solid rgba(164,156,144,.3)}
        .cq-plan-btn-ghost:hover{background:#f7f5f3;color:#1a1612}
        .cq-plan-btn-current{background:#6366f1;color:#fff;cursor:default}
        .cq-plan-limits{font-size:11px;color:#a09890;text-align:center;margin-top:8px}
        @media(max-width:1200px){.cq-pricing{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:768px){.cq-pricing{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.cq-pricing{grid-template-columns:1fr}}
      `}} />

      <div className="cq-pricing-wrap">

      {/* Current plan indicator */}
      <div style={{
        background: "#fdfcfb", borderRadius: 14, border: "1px solid rgba(164,156,144,.18)",
        padding: "16px 24px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <span style={{ fontSize: 13, color: "#7d756c" }}>Plan actuel : </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1612" }}>{currentTier === "FREE" ? "Free" : currentTier === "STARTER" ? "Starter" : currentTier === "GROWTH" ? "Growth" : currentTier === "PRO" ? "Pro" : "Scale"}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 999,
          background: currentTier === "FREE" ? "#f3f4f6" : currentTier === "STARTER" ? "#dbeafe" : currentTier === "GROWTH" ? "#dcfce7" : currentTier === "PRO" ? "#ede9fe" : "#fef3c7",
          color: currentTier === "FREE" ? "#6b7280" : currentTier === "STARTER" ? "#1d4ed8" : currentTier === "GROWTH" ? "#166534" : currentTier === "PRO" ? "#6d28d9" : "#92400e",
        }}>
          {currentTier === "FREE" ? "Gratuit" : "Actif"}
        </span>
      </div>

      {/* Plans grid */}
      <div className="cq-pricing">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isUpgrade = TIER_LEVEL[plan.tier] > TIER_LEVEL[currentTier];
          const isDowngrade = TIER_LEVEL[plan.tier] < TIER_LEVEL[currentTier];
          const isRecommended = plan.badge === "Recommandé";

          return (
            <div key={plan.tier} className={`cq-plan ${isRecommended ? "cq-plan-rec" : ""} ${isCurrent ? "cq-plan-current" : ""}`}>
              {/* Badge */}
              {plan.badge && !isCurrent && (
                <div className="cq-plan-badge" style={{
                  background: isRecommended ? "#4a8a32" : "#1a1612",
                  color: "#fff",
                }}>{plan.badge}</div>
              )}
              {isCurrent && (
                <div className="cq-plan-badge" style={{ background: "#6366f1", color: "#fff" }}>Plan actuel</div>
              )}

              {/* Header */}
              <div className="cq-plan-name">{plan.name}</div>
              <div className="cq-plan-price">
                <span className="cq-plan-price-num">{plan.price}</span>
                <span className="cq-plan-price-per">{plan.period}</span>
              </div>
              <div className="cq-plan-desc">{plan.description}</div>

              {/* Features */}
              <ul className="cq-plan-features">
                {plan.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`cq-plan-btn ${isCurrent ? "cq-plan-btn-current" : isRecommended ? "cq-plan-btn-brand" : isUpgrade ? "cq-plan-btn-primary" : "cq-plan-btn-ghost"}`}
                onClick={() => handleSelect(plan.tier)}
                disabled={isCurrent || isChanging}
              >
                {isCurrent ? "Plan actuel" : isDowngrade ? "Rétrograder" : plan.cta}
              </button>

              <div className="cq-plan-limits">{plan.limits}</div>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div style={{ background: "#fdfcfb", borderRadius: 14, border: "1px solid rgba(164,156,144,.18)", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1612", marginBottom: 16 }}>Questions fréquentes</div>
        {[
          { q: "Puis-je changer de plan à tout moment ?", a: "Oui, vous pouvez upgrader ou rétrograder à tout moment. Le changement prend effet immédiatement." },
          { q: "Y a-t-il un engagement ?", a: "Non, tous les plans sont sans engagement. Vous pouvez annuler à tout moment." },
          { q: "Comment fonctionne la facturation ?", a: "Le paiement est géré directement par Shopify sur votre facture habituelle. Pas besoin d'entrer une carte bancaire supplémentaire." },
          { q: "Que se passe-t-il si je dépasse la limite de produits ?", a: "Les produits existants restent scorés. Les nouveaux produits ne seront pas analysés tant que vous n'aurez pas upgradé." },
          { q: "Le DPP est-il obligatoire ?", a: "Le Passeport Numérique Produit sera obligatoire en EU dès 2027 pour le textile. Nous recommandons de vous préparer dès maintenant avec le plan Growth." },
        ].map((faq, i) => (
          <div key={i} style={{ marginBottom: i < 4 ? 14 : 0, paddingBottom: i < 4 ? 14 : 0, borderBottom: i < 4 ? "1px solid rgba(164,156,144,.1)" : "none" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1612", marginBottom: 4 }}>{faq.q}</div>
            <div style={{ fontSize: 12.5, color: "#7d756c", lineHeight: 1.5 }}>{faq.a}</div>
          </div>
        ))}
      </div>

      </div>{/* close cq-pricing-wrap */}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
