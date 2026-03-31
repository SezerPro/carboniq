/**
 * Plan constants — client-safe (no Prisma, no server imports)
 */

export type PlanTier = "FREE" | "STARTER" | "GROWTH" | "PRO" | "SCALE";

const TIER_LEVEL: Record<PlanTier, number> = {
  FREE: 0, STARTER: 1, GROWTH: 2, PRO: 3, SCALE: 4,
};

export function hasAccess(userPlan: PlanTier, requiredPlan: PlanTier): boolean {
  return TIER_LEVEL[userPlan] >= TIER_LEVEL[requiredPlan];
}

export interface FeatureGate {
  id: string;
  label: string;
  requiredPlan: PlanTier;
  description: string;
}

export const FEATURES: Record<string, FeatureGate> = {
  dashboard:        { id: "dashboard",        label: "Dashboard",               requiredPlan: "FREE",    description: "Vue d'ensemble de vos produits" },
  badge_basic:      { id: "badge_basic",      label: "Badge storefront (Pill)", requiredPlan: "FREE",    description: "Badge CO₂ sur vos pages produit" },
  carbon_calc:      { id: "carbon_calc",      label: "Calcul CO₂",             requiredPlan: "FREE",    description: "Scoring automatique ADEME" },
  recalculate:      { id: "recalculate",      label: "Recalculer",             requiredPlan: "FREE",    description: "Recalcul manuel des scores" },
  // ── STARTER ──
  export_data:      { id: "export_data",      label: "Export CSV/PDF",         requiredPlan: "STARTER", description: "Export données et rapports" },
  badge_all_styles: { id: "badge_all_styles", label: "4 styles de badge",      requiredPlan: "STARTER", description: "Pill, Leaf, Minimal, Detaille" },
  certificates:     { id: "certificates",     label: "Certificats d'impact",   requiredPlan: "STARTER", description: "Certificats avec code unique" },
  offset_api:       { id: "offset_api",       label: "Offset checkout",        requiredPlan: "STARTER", description: "API de compensation carbone" },
  dpp_basic:        { id: "dpp_basic",        label: "DPP basique",            requiredPlan: "STARTER", description: "3 categories de passeport EU" },
  reduction_basic:  { id: "reduction_basic",  label: "Reduction (basique)",    requiredPlan: "STARTER", description: "3 premieres suggestions" },
  reports_monthly:  { id: "reports_monthly",  label: "Rapport mensuel",        requiredPlan: "STARTER", description: "Rapport RSE mensuel" },
  settings:         { id: "settings",         label: "Parametres",             requiredPlan: "STARTER", description: "Configuration badge et offset" },
  impact_portal:    { id: "impact_portal",    label: "Portail d'impact",       requiredPlan: "STARTER", description: "Page publique partageable" },
  // ── GROWTH ──
  analytics:        { id: "analytics",        label: "Analytiques",            requiredPlan: "GROWTH",  description: "Tendances, equivalences, categories" },
  abtest:           { id: "abtest",           label: "A/B Testing",            requiredPlan: "GROWTH",  description: "3 tests actifs simultanes" },
  dpp:              { id: "dpp",              label: "DPP complet (10 cat.)",  requiredPlan: "GROWTH",  description: "Passeport EU ESPR 2027 complet" },
  compliance:       { id: "compliance",       label: "Conformite EU",          requiredPlan: "GROWTH",  description: "Scanner Green Claims (3 scans/mois)" },
  ai_categorize:    { id: "ai_categorize",    label: "IA categorisation",      requiredPlan: "GROWTH",  description: "Categorisation automatique IA" },
  benchmark:        { id: "benchmark",        label: "Benchmarking",           requiredPlan: "GROWTH",  description: "Comparaison avec votre secteur" },
  klaviyo:          { id: "klaviyo",          label: "Integration Klaviyo",    requiredPlan: "GROWTH",  description: "Segmentation clients eco" },
  multi_impact:     { id: "multi_impact",     label: "Multi-impact",           requiredPlan: "GROWTH",  description: "Arbres + ocean + carbone" },
  reduction_full:   { id: "reduction_full",   label: "Reduction complete",     requiredPlan: "GROWTH",  description: "Toutes les suggestions + score" },
  reports_quarterly:{ id: "reports_quarterly", label: "Rapports trimestriels", requiredPlan: "GROWTH",  description: "Rapports RSE trimestriels" },
  roi:              { id: "roi",              label: "ROI Dashboard",          requiredPlan: "GROWTH",  description: "Impact business et revenue" },
  // ── PRO ──
  scope3:           { id: "scope3",           label: "Scope 3",               requiredPlan: "PRO",     description: "Estimation auto supply chain" },
  reports_annual:   { id: "reports_annual",   label: "Rapports annuels",      requiredPlan: "PRO",     description: "Rapports RSE trimestriels + annuels" },
  flow_basic:       { id: "flow_basic",       label: "Shopify Flow (3)",      requiredPlan: "PRO",     description: "3 triggers automatises" },
  // ── SCALE ──
  scope3_full:      { id: "scope3_full",      label: "Scope 3 complet",       requiredPlan: "SCALE",   description: "Estimation + saisie manuelle" },
  compliance_full:  { id: "compliance_full",  label: "Conformite illimitee",   requiredPlan: "SCALE",   description: "Scans Green Claims illimites" },
  reports_csrd:     { id: "reports_csrd",     label: "Rapports CSRD",         requiredPlan: "SCALE",   description: "Rapports compatibles CSRD" },
  abtest_unlimited: { id: "abtest_unlimited", label: "A/B tests illimites",   requiredPlan: "SCALE",   description: "Tests de badge illimites" },
  flow_triggers:    { id: "flow_triggers",    label: "Shopify Flow illimite", requiredPlan: "SCALE",   description: "Triggers et actions illimites" },
};

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  price: string;
  priceNum: number;
  period: string;
  description: string;
  badge?: string;
  features: string[];
  limits: string;
  cta: string;
}

export const PLANS: PlanInfo[] = [
  {
    tier: "FREE", name: "Free", price: "0€", priceNum: 0, period: "pour toujours",
    description: "Decouvrez l'empreinte carbone de vos produits",
    features: [
      "10 produits analyses",
      "Badge CO2 (style Pill)",
      "Calcul automatique ADEME",
      "Dashboard basique",
    ],
    limits: "10 produits", cta: "Commencer gratuitement",
  },
  {
    tier: "STARTER", name: "Starter", price: "19,90€", priceNum: 19.90, period: "/mois",
    description: "Compensez et communiquez votre impact", badge: "Populaire",
    features: [
      "100 produits analyses",
      "4 styles de badge premium",
      "Compensation carbone (API)",
      "Certificats d'impact (50/mois)",
      "DPP basique (3 categories)",
      "Suggestions de reduction",
      "Rapport RSE mensuel",
      "Portail d'impact public",
      "Parametres complets",
    ],
    limits: "100 produits · 50 certificats/mois", cta: "Commencer maintenant",
  },
  {
    tier: "GROWTH", name: "Growth", price: "49,90€", priceNum: 49.90, period: "/mois",
    description: "Analysez, optimisez et preparez-vous a l'EU 2027", badge: "Recommande",
    features: [
      "1 000 produits analyses",
      "Tout Starter +",
      "DPP complet (10 categories)",
      "Analytiques avances & equivalences",
      "Conformite EU Green Claims (3 scans/mois)",
      "A/B Testing (3 tests actifs)",
      "IA auto-categorisation",
      "Benchmarking secteur",
      "Integration Klaviyo",
      "Multi-impact (arbres + ocean)",
      "ROI Dashboard",
      "Rapports trimestriels",
      "Support email prioritaire (24h)",
    ],
    limits: "1 000 produits · 500 certificats/mois", cta: "Commencer maintenant",
  },
  {
    tier: "PRO", name: "Pro", price: "89,90€", priceNum: 89.90, period: "/mois",
    description: "Scope 3, Flow et reporting avance",
    features: [
      "5 000 produits analyses",
      "Tout Growth +",
      "Scope 3 (estimation auto)",
      "Conformite EU (10 scans/mois)",
      "A/B Testing (10 tests actifs)",
      "Shopify Flow (3 triggers)",
      "Rapports trimestriels + annuels",
      "Certificats (2 000/mois)",
      "Support email prioritaire (12h)",
    ],
    limits: "5 000 produits · 2 000 certificats/mois", cta: "Commencer maintenant",
  },
  {
    tier: "SCALE", name: "Scale", price: "149,90€", priceNum: 149.90, period: "/mois",
    description: "Conformite totale et reporting entreprise",
    features: [
      "Produits illimites",
      "Tout Growth +",
      "Conformite EU illimitee",
      "Scope 3 (supply chain)",
      "Rapports annuels CSRD",
      "A/B tests illimites",
      "Shopify Flow triggers",
      "CSM dedie + support prioritaire",
    ],
    limits: "Illimite", cta: "Commencer maintenant",
  },
];
