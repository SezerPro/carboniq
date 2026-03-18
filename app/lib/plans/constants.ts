/**
 * Plan constants — client-safe (no Prisma, no server imports)
 */

export type PlanTier = "FREE" | "STARTER" | "GROWTH" | "SCALE";

const TIER_LEVEL: Record<PlanTier, number> = {
  FREE: 0, STARTER: 1, GROWTH: 2, SCALE: 3,
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
  badge_all_styles: { id: "badge_all_styles", label: "4 styles de badge",      requiredPlan: "STARTER", description: "Pill, Leaf, Minimal, Détaillé" },
  certificates:     { id: "certificates",     label: "Certificats d'impact",   requiredPlan: "STARTER", description: "Certificats avec code unique" },
  offset_api:       { id: "offset_api",       label: "Offset checkout",        requiredPlan: "STARTER", description: "API de compensation carbone" },
  reduction_basic:  { id: "reduction_basic",  label: "Réduction (basique)",    requiredPlan: "STARTER", description: "3 premières suggestions" },
  reports_monthly:  { id: "reports_monthly",  label: "Rapport mensuel",        requiredPlan: "STARTER", description: "Rapport RSE mensuel" },
  settings:         { id: "settings",         label: "Paramètres",             requiredPlan: "STARTER", description: "Configuration badge et offset" },
  impact_portal:    { id: "impact_portal",    label: "Portail d'impact",       requiredPlan: "STARTER", description: "Page publique partageable" },
  analytics:        { id: "analytics",        label: "Analytiques",            requiredPlan: "GROWTH",  description: "Tendances, équivalences, catégories" },
  abtest:           { id: "abtest",           label: "A/B Testing",            requiredPlan: "GROWTH",  description: "Tester et optimiser le badge" },
  dpp:              { id: "dpp",              label: "Passeport Produit (DPP)", requiredPlan: "GROWTH",  description: "Conforme EU ESPR 2027" },
  ai_categorize:    { id: "ai_categorize",    label: "IA catégorisation",      requiredPlan: "GROWTH",  description: "Catégorisation automatique IA" },
  benchmark:        { id: "benchmark",        label: "Benchmarking",           requiredPlan: "GROWTH",  description: "Comparaison avec votre secteur" },
  klaviyo:          { id: "klaviyo",          label: "Intégration Klaviyo",    requiredPlan: "GROWTH",  description: "Segmentation clients éco" },
  multi_impact:     { id: "multi_impact",     label: "Multi-impact",           requiredPlan: "GROWTH",  description: "Arbres + océan + carbone" },
  reduction_full:   { id: "reduction_full",   label: "Réduction complète",     requiredPlan: "GROWTH",  description: "Toutes les suggestions + score" },
  reports_quarterly:{ id: "reports_quarterly", label: "Rapports trimestriels", requiredPlan: "GROWTH",  description: "Rapports RSE trimestriels" },
  roi:              { id: "roi",              label: "ROI Dashboard",          requiredPlan: "GROWTH",  description: "Impact business et revenue" },
  compliance:       { id: "compliance",       label: "Conformité EU",          requiredPlan: "SCALE",   description: "Scanner Green Claims EU" },
  scope3:           { id: "scope3",           label: "Scope 3",               requiredPlan: "SCALE",   description: "Émissions supply chain" },
  reports_annual:   { id: "reports_annual",   label: "Rapports annuels CSRD", requiredPlan: "SCALE",   description: "Rapports compatibles CSRD" },
  abtest_unlimited: { id: "abtest_unlimited", label: "A/B tests illimités",   requiredPlan: "SCALE",   description: "Tests de badge illimités" },
  flow_triggers:    { id: "flow_triggers",    label: "Shopify Flow",          requiredPlan: "SCALE",   description: "Triggers et actions automatisées" },
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
    description: "Découvrez l'empreinte carbone de vos produits",
    features: ["10 produits analysés", "Badge CO₂ (style Pill)", "Calcul automatique ADEME", "Dashboard basique"],
    limits: "10 produits", cta: "Commencer gratuitement",
  },
  {
    tier: "STARTER", name: "Starter", price: "14,90€", priceNum: 14.90, period: "/mois",
    description: "Compensez et communiquez votre impact", badge: "Populaire",
    features: ["100 produits analysés", "4 styles de badge premium", "Compensation carbone (API)", "Certificats d'impact (50/mois)", "Suggestions de réduction", "Rapport RSE mensuel", "Portail d'impact public", "Paramètres complets"],
    limits: "100 produits · 50 certificats/mois", cta: "Commencer maintenant",
  },
  {
    tier: "GROWTH", name: "Growth", price: "49,90€", priceNum: 49.90, period: "/mois",
    description: "Analysez, optimisez et préparez-vous à l'EU 2027", badge: "Recommandé",
    features: ["1 000 produits analysés", "Tout Starter +", "Analytiques avancés & équivalences", "Passeport Produit Digital (DPP EU)", "A/B Testing du badge", "IA auto-catégorisation", "Benchmarking secteur", "Intégration Klaviyo", "Multi-impact (arbres + océan)", "ROI Dashboard", "Rapports trimestriels"],
    limits: "1 000 produits · 500 certificats/mois", cta: "Commencer maintenant",
  },
  {
    tier: "SCALE", name: "Scale", price: "149,90€", priceNum: 149.90, period: "/mois",
    description: "Conformité totale et reporting entreprise",
    features: ["Produits illimités", "Tout Growth +", "Conformité EU Green Claims", "Scope 3 (supply chain)", "Rapports annuels CSRD", "A/B tests illimités", "Shopify Flow triggers", "Support prioritaire"],
    limits: "Illimité", cta: "Commencer maintenant",
  },
];
