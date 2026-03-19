/**
 * Carboniq i18n — 8 languages
 * en, fr, de, es, pt, it, nl, ja
 */

export type Locale = "en" | "fr" | "de" | "es" | "pt" | "it" | "nl" | "ja";

export const SUPPORTED_LOCALES: Locale[] = ["en", "fr", "de", "es", "pt", "it", "nl", "ja"];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  ja: "日本語",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧", fr: "🇫🇷", de: "🇩🇪", es: "🇪🇸", pt: "🇧🇷", it: "🇮🇹", nl: "🇳🇱", ja: "🇯🇵",
};

// Detect locale from browser or Shopify session
export function detectLocale(acceptLanguage?: string | null): Locale {
  if (!acceptLanguage) return "en";
  const lang = acceptLanguage.split(",")[0]?.split("-")[0]?.toLowerCase();
  if (lang && SUPPORTED_LOCALES.includes(lang as Locale)) return lang as Locale;
  return "en";
}

// ── Translation keys ──────────────────────────────────

type TranslationKeys = {
  // Nav & common
  dashboard: string;
  analytics: string;
  reduce: string;
  dpp: string;
  reports: string;
  compliance: string;
  abtest: string;
  roi: string;
  benchmark: string;
  scope3: string;
  impact: string;
  settings: string;
  pricing: string;
  plans: string;

  // Dashboard
  products_analyzed: string;
  avg_score: string;
  co2_per_product: string;
  available_of: string;
  low: string;
  medium: string;
  high: string;
  very_high: string;
  recalculate_all: string;
  products: string;
  confidence: string;
  quota_usage: string;
  used: string;
  modules: string;
  product_catalog: string;
  no_products: string;
  launch_analysis: string;

  // Impact labels
  low_impact: string;
  moderate_impact: string;
  high_impact: string;
  very_high_impact: string;

  // Nav descriptions
  nav_analytics: string;
  nav_reduce: string;
  nav_dpp: string;
  nav_reports: string;
  nav_compliance: string;
  nav_abtest: string;
  nav_roi: string;
  nav_benchmark: string;
  nav_scope3: string;
  nav_impact: string;
  nav_settings: string;
  nav_plans: string;

  // Pricing
  current_plan: string;
  free_forever: string;
  per_month: string;
  start_free: string;
  start_now: string;
  downgrade: string;
  popular: string;
  recommended: string;
  active: string;
  free: string;
  unlimited: string;
  faq: string;

  // Compliance
  days_remaining: string;
  compliance_score: string;
  scan_my_store: string;
  scanning: string;
  no_issues: string;
  compliant: string;
  to_improve: string;
  non_compliant: string;
  compliant_templates: string;
  scan_history: string;
  elements_analyzed: string;
  problems: string;

  // Reduction
  reduction_potential: string;
  commitments_taken: string;
  potential_savings: string;
  achieved_savings: string;
  estimated_reduction: string;
  engagement_score: string;
  commit: string;
  remove: string;
  recommendations: string;
  suggestions: string;
  disclaimer_title: string;
  disclaimer_text: string;

  // Reports
  monthly_report: string;
  quarterly_report: string;
  annual_report: string;
  this_month: string;
  this_quarter: string;
  this_year: string;
  generated_reports: string;
  generated_on: string;
  footprint: string;
  offset: string;
  net: string;
  trees: string;

  // DPP
  generate_all_dpp: string;
  dpp_generated: string;
  pending: string;
  view_sheet: string;
  copy: string;
  edit: string;
  generate: string;
  save_regenerate: string;
  origin_country: string;
  durability_years: string;
  materials_composition: string;
  recyclability: string;
  end_of_life: string;
  care_instructions: string;
  certifications: string;
  product_category: string;

  // Common actions
  save: string;
  cancel: string;
  delete: string;
  export: string;
  close: string;
  loading: string;
  error: string;
  success: string;

  // Units
  kg: string;
  kg_co2: string;
  eur: string;
};

// ── Translations ──────────────────────────────────────

const en: TranslationKeys = {
  dashboard: "Dashboard", analytics: "Analytics", reduce: "Reduce", dpp: "DPP", reports: "RSE Reports",
  compliance: "EU Compliance", abtest: "A/B Testing", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Public Impact", settings: "Settings", pricing: "Plans & Pricing", plans: "Plans",

  products_analyzed: "Products analyzed", avg_score: "Average score", co2_per_product: "CO2 per product",
  available_of: "of {limit} available", low: "Low", medium: "Moderate", high: "High", very_high: "Very high",
  recalculate_all: "Recalculate all", products: "Products", confidence: "Confidence",
  quota_usage: "Quota usage", used: "used", modules: "Modules", product_catalog: "Product catalog",
  no_products: "No products analyzed", launch_analysis: "Launch analysis",

  low_impact: "Low impact", moderate_impact: "Moderate impact", high_impact: "High impact", very_high_impact: "Very high impact",

  nav_analytics: "Trends", nav_reduce: "AI tips", nav_dpp: "EU Passport", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Optimize", nav_roi: "Performance", nav_benchmark: "Sector",
  nav_scope3: "Supply chain", nav_impact: "Public portal", nav_settings: "Config", nav_plans: "Pricing",

  current_plan: "Current plan", free_forever: "forever", per_month: "/month", start_free: "Start for free",
  start_now: "Start now", downgrade: "Downgrade", popular: "Popular", recommended: "Recommended",
  active: "Active", free: "Free", unlimited: "Unlimited", faq: "Frequently asked questions",

  days_remaining: "days remaining", compliance_score: "Compliance score", scan_my_store: "Scan my store",
  scanning: "Scanning...", no_issues: "No issues detected", compliant: "Compliant", to_improve: "To improve",
  non_compliant: "Non compliant", compliant_templates: "Compliant claim templates", scan_history: "Scan history",
  elements_analyzed: "elements analyzed", problems: "problems",

  reduction_potential: "Estimated reduction potential", commitments_taken: "Commitments taken",
  potential_savings: "Potential savings", achieved_savings: "Committed savings", estimated_reduction: "Estimated reduction",
  engagement_score: "Engagement score", commit: "Commit", remove: "Remove", recommendations: "Recommendations",
  suggestions: "suggestions", disclaimer_title: "Warning — Unverified estimates",
  disclaimer_text: "The savings shown are estimates based on ADEME sector averages. They do not constitute an actual measurement of reduction. Effective savings depend on concrete implementation by the merchant. Under EU Directive 2024/825 (EmpCo), no environmental claim should be communicated to customers without verifiable proof. The 'Commit' button records an intention, not a verified action.",

  monthly_report: "Monthly Report", quarterly_report: "Quarterly Report", annual_report: "Annual Report",
  this_month: "This month", this_quarter: "This quarter", this_year: "This year",
  generated_reports: "Generated reports", generated_on: "Generated on", footprint: "Footprint",
  offset: "Offset", net: "Net", trees: "Trees",

  generate_all_dpp: "Generate all DPPs", dpp_generated: "Generated", pending: "Pending",
  view_sheet: "View sheet", copy: "Copy", edit: "Edit", generate: "Generate", save_regenerate: "Save and regenerate DPP",
  origin_country: "Country of manufacture", durability_years: "Estimated lifespan (years)",
  materials_composition: "Materials composition", recyclability: "Recyclability", end_of_life: "End of life",
  care_instructions: "Care instructions", certifications: "Certifications", product_category: "Product category",

  save: "Save", cancel: "Cancel", delete: "Delete", export: "Export", close: "Close",
  loading: "Loading...", error: "Error", success: "Success",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const fr: TranslationKeys = {
  dashboard: "Tableau de bord", analytics: "Analytiques", reduce: "Reduire", dpp: "DPP", reports: "Rapports RSE",
  compliance: "Conformite EU", abtest: "A/B Testing", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Impact public", settings: "Parametres", pricing: "Plans & Tarifs", plans: "Plans",

  products_analyzed: "Produits analyses", avg_score: "Score moyen", co2_per_product: "CO2 par produit",
  available_of: "sur {limit} disponibles", low: "Faible", medium: "Modere", high: "Eleve", very_high: "Tres eleve",
  recalculate_all: "Recalculer tout", products: "Produits", confidence: "Confiance",
  quota_usage: "Utilisation du quota", used: "utilise", modules: "Modules", product_catalog: "Catalogue produits",
  no_products: "Aucun produit analyse", launch_analysis: "Lancer l'analyse",

  low_impact: "Faible impact", moderate_impact: "Impact modere", high_impact: "Impact eleve", very_high_impact: "Impact tres eleve",

  nav_analytics: "Tendances", nav_reduce: "Conseils IA", nav_dpp: "Passeport EU", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Optimiser", nav_roi: "Performance", nav_benchmark: "Secteur",
  nav_scope3: "Supply chain", nav_impact: "Portail public", nav_settings: "Config", nav_plans: "Tarification",

  current_plan: "Plan actuel", free_forever: "pour toujours", per_month: "/mois", start_free: "Commencer gratuitement",
  start_now: "Commencer maintenant", downgrade: "Retrograder", popular: "Populaire", recommended: "Recommande",
  active: "Actif", free: "Gratuit", unlimited: "Illimite", faq: "Questions frequentes",

  days_remaining: "jours restants", compliance_score: "Score de conformite", scan_my_store: "Scanner ma boutique",
  scanning: "Scan en cours...", no_issues: "Aucun probleme detecte", compliant: "Conforme", to_improve: "A ameliorer",
  non_compliant: "Non conforme", compliant_templates: "Modeles de claims conformes", scan_history: "Historique des scans",
  elements_analyzed: "elements analyses", problems: "problemes",

  reduction_potential: "Potentiel de reduction estime", commitments_taken: "Engagements pris",
  potential_savings: "Economie potentielle", achieved_savings: "Engagements pris", estimated_reduction: "Reduction estimee",
  engagement_score: "Score d'engagement", commit: "M'engager", remove: "Retirer", recommendations: "Recommandations",
  suggestions: "suggestions", disclaimer_title: "Avertissement — Estimations non verifiees",
  disclaimer_text: "Les economies affichees sont des estimations basees sur des moyennes sectorielles ADEME. Elles ne constituent pas une mesure reelle de reduction. Les economies effectives dependent de la mise en oeuvre concrete par le marchand. Conformement a la directive EU 2024/825 (EmpCo), aucune claim environnementale ne doit etre communiquee aux clients sans preuve verifiable. Le bouton 'M'engager' enregistre une intention, pas une action verifiee.",

  monthly_report: "Rapport Mensuel", quarterly_report: "Rapport Trimestriel", annual_report: "Rapport Annuel",
  this_month: "Ce mois", this_quarter: "Ce trimestre", this_year: "Cette annee",
  generated_reports: "Rapports generes", generated_on: "Genere le", footprint: "Empreinte",
  offset: "Compense", net: "Net", trees: "Arbres",

  generate_all_dpp: "Generer tous les DPP", dpp_generated: "Genere", pending: "En attente",
  view_sheet: "Voir la fiche", copy: "Copier", edit: "Modifier", generate: "Generer", save_regenerate: "Sauvegarder et regenerer le DPP",
  origin_country: "Pays de fabrication", durability_years: "Duree de vie estimee (annees)",
  materials_composition: "Composition des materiaux", recyclability: "Recyclabilite", end_of_life: "Fin de vie",
  care_instructions: "Instructions d'entretien", certifications: "Certifications", product_category: "Categorie du produit",

  save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", export: "Exporter", close: "Fermer",
  loading: "Chargement...", error: "Erreur", success: "Succes",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const de: TranslationKeys = {
  dashboard: "Dashboard", analytics: "Analytik", reduce: "Reduzieren", dpp: "DPP", reports: "RSE-Berichte",
  compliance: "EU-Konformitat", abtest: "A/B-Tests", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Offentlicher Impact", settings: "Einstellungen", pricing: "Plane & Preise", plans: "Plane",

  products_analyzed: "Analysierte Produkte", avg_score: "Durchschnitt", co2_per_product: "CO2 pro Produkt",
  available_of: "von {limit} verfugbar", low: "Niedrig", medium: "Mittel", high: "Hoch", very_high: "Sehr hoch",
  recalculate_all: "Alles neu berechnen", products: "Produkte", confidence: "Vertrauen",
  quota_usage: "Kontingentnutzung", used: "verwendet", modules: "Module", product_catalog: "Produktkatalog",
  no_products: "Keine analysierten Produkte", launch_analysis: "Analyse starten",

  low_impact: "Geringe Auswirkung", moderate_impact: "Mittlere Auswirkung", high_impact: "Hohe Auswirkung", very_high_impact: "Sehr hohe Auswirkung",

  nav_analytics: "Trends", nav_reduce: "KI-Tipps", nav_dpp: "EU-Pass", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Optimieren", nav_roi: "Leistung", nav_benchmark: "Branche",
  nav_scope3: "Lieferkette", nav_impact: "Offentliches Portal", nav_settings: "Konfig", nav_plans: "Preise",

  current_plan: "Aktueller Plan", free_forever: "fur immer", per_month: "/Monat", start_free: "Kostenlos starten",
  start_now: "Jetzt starten", downgrade: "Herabstufen", popular: "Beliebt", recommended: "Empfohlen",
  active: "Aktiv", free: "Kostenlos", unlimited: "Unbegrenzt", faq: "Haufig gestellte Fragen",

  days_remaining: "Tage verbleibend", compliance_score: "Konformitatsbewertung", scan_my_store: "Meinen Shop scannen",
  scanning: "Wird gescannt...", no_issues: "Keine Probleme erkannt", compliant: "Konform", to_improve: "Zu verbessern",
  non_compliant: "Nicht konform", compliant_templates: "Konforme Vorlagen", scan_history: "Scan-Verlauf",
  elements_analyzed: "Elemente analysiert", problems: "Probleme",

  reduction_potential: "Geschatztes Reduktionspotenzial", commitments_taken: "Verpflichtungen eingegangen",
  potential_savings: "Mogliche Einsparungen", achieved_savings: "Eingegangene Verpflichtungen", estimated_reduction: "Geschatzte Reduktion",
  engagement_score: "Engagement-Score", commit: "Verpflichten", remove: "Entfernen", recommendations: "Empfehlungen",
  suggestions: "Vorschlage", disclaimer_title: "Warnung — Unuberprfte Schatzungen",
  disclaimer_text: "Die angezeigten Einsparungen sind Schatzungen basierend auf ADEME-Branchendurchschnitten. Sie stellen keine tatsachliche Messung dar.",

  monthly_report: "Monatsbericht", quarterly_report: "Quartalsbericht", annual_report: "Jahresbericht",
  this_month: "Dieser Monat", this_quarter: "Dieses Quartal", this_year: "Dieses Jahr",
  generated_reports: "Erstellte Berichte", generated_on: "Erstellt am", footprint: "Fussabdruck",
  offset: "Kompensiert", net: "Netto", trees: "Baume",

  generate_all_dpp: "Alle DPPs generieren", dpp_generated: "Generiert", pending: "Ausstehend",
  view_sheet: "Datenblatt ansehen", copy: "Kopieren", edit: "Bearbeiten", generate: "Generieren", save_regenerate: "Speichern und DPP neu generieren",
  origin_country: "Herstellungsland", durability_years: "Geschatzte Lebensdauer (Jahre)",
  materials_composition: "Materialzusammensetzung", recyclability: "Recycelbarkeit", end_of_life: "Lebensende",
  care_instructions: "Pflegehinweise", certifications: "Zertifizierungen", product_category: "Produktkategorie",

  save: "Speichern", cancel: "Abbrechen", delete: "Loschen", export: "Exportieren", close: "Schliessen",
  loading: "Laden...", error: "Fehler", success: "Erfolg",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const es: TranslationKeys = {
  dashboard: "Panel", analytics: "Analiticas", reduce: "Reducir", dpp: "DPP", reports: "Informes RSE",
  compliance: "Conformidad UE", abtest: "Pruebas A/B", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Impacto publico", settings: "Configuracion", pricing: "Planes y precios", plans: "Planes",

  products_analyzed: "Productos analizados", avg_score: "Puntuacion media", co2_per_product: "CO2 por producto",
  available_of: "de {limit} disponibles", low: "Bajo", medium: "Moderado", high: "Alto", very_high: "Muy alto",
  recalculate_all: "Recalcular todo", products: "Productos", confidence: "Confianza",
  quota_usage: "Uso de cuota", used: "usado", modules: "Modulos", product_catalog: "Catalogo de productos",
  no_products: "Sin productos analizados", launch_analysis: "Iniciar analisis",

  low_impact: "Bajo impacto", moderate_impact: "Impacto moderado", high_impact: "Alto impacto", very_high_impact: "Impacto muy alto",

  nav_analytics: "Tendencias", nav_reduce: "Consejos IA", nav_dpp: "Pasaporte UE", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Optimizar", nav_roi: "Rendimiento", nav_benchmark: "Sector",
  nav_scope3: "Cadena de suministro", nav_impact: "Portal publico", nav_settings: "Config", nav_plans: "Precios",

  current_plan: "Plan actual", free_forever: "para siempre", per_month: "/mes", start_free: "Empezar gratis",
  start_now: "Empezar ahora", downgrade: "Bajar de plan", popular: "Popular", recommended: "Recomendado",
  active: "Activo", free: "Gratis", unlimited: "Ilimitado", faq: "Preguntas frecuentes",

  days_remaining: "dias restantes", compliance_score: "Puntuacion de conformidad", scan_my_store: "Escanear mi tienda",
  scanning: "Escaneando...", no_issues: "Sin problemas detectados", compliant: "Conforme", to_improve: "A mejorar",
  non_compliant: "No conforme", compliant_templates: "Plantillas conformes", scan_history: "Historial de escaneos",
  elements_analyzed: "elementos analizados", problems: "problemas",

  reduction_potential: "Potencial de reduccion estimado", commitments_taken: "Compromisos adquiridos",
  potential_savings: "Ahorro potencial", achieved_savings: "Ahorros comprometidos", estimated_reduction: "Reduccion estimada",
  engagement_score: "Puntuacion de compromiso", commit: "Comprometerse", remove: "Eliminar", recommendations: "Recomendaciones",
  suggestions: "sugerencias", disclaimer_title: "Aviso — Estimaciones no verificadas",
  disclaimer_text: "Los ahorros mostrados son estimaciones basadas en promedios sectoriales ADEME. No constituyen una medicion real de reduccion.",

  monthly_report: "Informe mensual", quarterly_report: "Informe trimestral", annual_report: "Informe anual",
  this_month: "Este mes", this_quarter: "Este trimestre", this_year: "Este ano",
  generated_reports: "Informes generados", generated_on: "Generado el", footprint: "Huella",
  offset: "Compensado", net: "Neto", trees: "Arboles",

  generate_all_dpp: "Generar todos los DPP", dpp_generated: "Generado", pending: "Pendiente",
  view_sheet: "Ver ficha", copy: "Copiar", edit: "Editar", generate: "Generar", save_regenerate: "Guardar y regenerar DPP",
  origin_country: "Pais de fabricacion", durability_years: "Vida util estimada (anos)",
  materials_composition: "Composicion de materiales", recyclability: "Reciclabilidad", end_of_life: "Fin de vida",
  care_instructions: "Instrucciones de cuidado", certifications: "Certificaciones", product_category: "Categoria del producto",

  save: "Guardar", cancel: "Cancelar", delete: "Eliminar", export: "Exportar", close: "Cerrar",
  loading: "Cargando...", error: "Error", success: "Exito",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const pt: TranslationKeys = {
  dashboard: "Painel", analytics: "Analiticas", reduce: "Reduzir", dpp: "DPP", reports: "Relatorios RSE",
  compliance: "Conformidade UE", abtest: "Testes A/B", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Impacto publico", settings: "Configuracoes", pricing: "Planos e precos", plans: "Planos",

  products_analyzed: "Produtos analisados", avg_score: "Pontuacao media", co2_per_product: "CO2 por produto",
  available_of: "de {limit} disponiveis", low: "Baixo", medium: "Moderado", high: "Alto", very_high: "Muito alto",
  recalculate_all: "Recalcular tudo", products: "Produtos", confidence: "Confianca",
  quota_usage: "Uso de cota", used: "usado", modules: "Modulos", product_catalog: "Catalogo de produtos",
  no_products: "Nenhum produto analisado", launch_analysis: "Iniciar analise",

  low_impact: "Baixo impacto", moderate_impact: "Impacto moderado", high_impact: "Alto impacto", very_high_impact: "Impacto muito alto",

  nav_analytics: "Tendencias", nav_reduce: "Dicas IA", nav_dpp: "Passaporte UE", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Otimizar", nav_roi: "Desempenho", nav_benchmark: "Setor",
  nav_scope3: "Cadeia de fornecimento", nav_impact: "Portal publico", nav_settings: "Config", nav_plans: "Precos",

  current_plan: "Plano atual", free_forever: "para sempre", per_month: "/mes", start_free: "Comecar gratis",
  start_now: "Comecar agora", downgrade: "Rebaixar", popular: "Popular", recommended: "Recomendado",
  active: "Ativo", free: "Gratis", unlimited: "Ilimitado", faq: "Perguntas frequentes",

  days_remaining: "dias restantes", compliance_score: "Pontuacao de conformidade", scan_my_store: "Escanear minha loja",
  scanning: "Escaneando...", no_issues: "Nenhum problema detectado", compliant: "Conforme", to_improve: "A melhorar",
  non_compliant: "Nao conforme", compliant_templates: "Modelos conformes", scan_history: "Historico de escaneamentos",
  elements_analyzed: "elementos analisados", problems: "problemas",

  reduction_potential: "Potencial de reducao estimado", commitments_taken: "Compromissos assumidos",
  potential_savings: "Economia potencial", achieved_savings: "Economias comprometidas", estimated_reduction: "Reducao estimada",
  engagement_score: "Pontuacao de engajamento", commit: "Comprometer-se", remove: "Remover", recommendations: "Recomendacoes",
  suggestions: "sugestoes", disclaimer_title: "Aviso — Estimativas nao verificadas",
  disclaimer_text: "As economias exibidas sao estimativas baseadas em medias setoriais ADEME. Nao constituem uma medicao real de reducao.",

  monthly_report: "Relatorio mensal", quarterly_report: "Relatorio trimestral", annual_report: "Relatorio anual",
  this_month: "Este mes", this_quarter: "Este trimestre", this_year: "Este ano",
  generated_reports: "Relatorios gerados", generated_on: "Gerado em", footprint: "Pegada",
  offset: "Compensado", net: "Liquido", trees: "Arvores",

  generate_all_dpp: "Gerar todos os DPPs", dpp_generated: "Gerado", pending: "Pendente",
  view_sheet: "Ver ficha", copy: "Copiar", edit: "Editar", generate: "Gerar", save_regenerate: "Salvar e regenerar DPP",
  origin_country: "Pais de fabricacao", durability_years: "Vida util estimada (anos)",
  materials_composition: "Composicao de materiais", recyclability: "Reciclabilidade", end_of_life: "Fim de vida",
  care_instructions: "Instrucoes de cuidado", certifications: "Certificacoes", product_category: "Categoria do produto",

  save: "Salvar", cancel: "Cancelar", delete: "Excluir", export: "Exportar", close: "Fechar",
  loading: "Carregando...", error: "Erro", success: "Sucesso",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const it: TranslationKeys = {
  dashboard: "Dashboard", analytics: "Analisi", reduce: "Ridurre", dpp: "DPP", reports: "Report RSE",
  compliance: "Conformita UE", abtest: "Test A/B", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Impatto pubblico", settings: "Impostazioni", pricing: "Piani e prezzi", plans: "Piani",

  products_analyzed: "Prodotti analizzati", avg_score: "Punteggio medio", co2_per_product: "CO2 per prodotto",
  available_of: "di {limit} disponibili", low: "Basso", medium: "Moderato", high: "Alto", very_high: "Molto alto",
  recalculate_all: "Ricalcola tutto", products: "Prodotti", confidence: "Affidabilita",
  quota_usage: "Utilizzo quota", used: "utilizzato", modules: "Moduli", product_catalog: "Catalogo prodotti",
  no_products: "Nessun prodotto analizzato", launch_analysis: "Avvia analisi",

  low_impact: "Basso impatto", moderate_impact: "Impatto moderato", high_impact: "Alto impatto", very_high_impact: "Impatto molto alto",

  nav_analytics: "Tendenze", nav_reduce: "Consigli IA", nav_dpp: "Passaporto UE", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Ottimizza", nav_roi: "Prestazioni", nav_benchmark: "Settore",
  nav_scope3: "Catena di fornitura", nav_impact: "Portale pubblico", nav_settings: "Config", nav_plans: "Prezzi",

  current_plan: "Piano attuale", free_forever: "per sempre", per_month: "/mese", start_free: "Inizia gratis",
  start_now: "Inizia ora", downgrade: "Declassa", popular: "Popolare", recommended: "Raccomandato",
  active: "Attivo", free: "Gratuito", unlimited: "Illimitato", faq: "Domande frequenti",

  days_remaining: "giorni rimanenti", compliance_score: "Punteggio di conformita", scan_my_store: "Scansiona il mio negozio",
  scanning: "Scansione...", no_issues: "Nessun problema rilevato", compliant: "Conforme", to_improve: "Da migliorare",
  non_compliant: "Non conforme", compliant_templates: "Modelli conformi", scan_history: "Cronologia scansioni",
  elements_analyzed: "elementi analizzati", problems: "problemi",

  reduction_potential: "Potenziale di riduzione stimato", commitments_taken: "Impegni presi",
  potential_savings: "Risparmio potenziale", achieved_savings: "Risparmi impegnati", estimated_reduction: "Riduzione stimata",
  engagement_score: "Punteggio di impegno", commit: "Impegnarsi", remove: "Rimuovere", recommendations: "Raccomandazioni",
  suggestions: "suggerimenti", disclaimer_title: "Avviso — Stime non verificate",
  disclaimer_text: "I risparmi mostrati sono stime basate su medie settoriali ADEME. Non costituiscono una misurazione reale di riduzione.",

  monthly_report: "Report mensile", quarterly_report: "Report trimestrale", annual_report: "Report annuale",
  this_month: "Questo mese", this_quarter: "Questo trimestre", this_year: "Quest'anno",
  generated_reports: "Report generati", generated_on: "Generato il", footprint: "Impronta",
  offset: "Compensato", net: "Netto", trees: "Alberi",

  generate_all_dpp: "Genera tutti i DPP", dpp_generated: "Generato", pending: "In attesa",
  view_sheet: "Vedi scheda", copy: "Copia", edit: "Modifica", generate: "Genera", save_regenerate: "Salva e rigenera DPP",
  origin_country: "Paese di produzione", durability_years: "Durata stimata (anni)",
  materials_composition: "Composizione materiali", recyclability: "Riciclabilita", end_of_life: "Fine vita",
  care_instructions: "Istruzioni di cura", certifications: "Certificazioni", product_category: "Categoria prodotto",

  save: "Salva", cancel: "Annulla", delete: "Elimina", export: "Esporta", close: "Chiudi",
  loading: "Caricamento...", error: "Errore", success: "Successo",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const nl: TranslationKeys = {
  dashboard: "Dashboard", analytics: "Analyse", reduce: "Verminderen", dpp: "DPP", reports: "RSE-rapporten",
  compliance: "EU-naleving", abtest: "A/B-testen", roi: "ROI", benchmark: "Benchmark",
  scope3: "Scope 3", impact: "Publieke impact", settings: "Instellingen", pricing: "Plannen & prijzen", plans: "Plannen",

  products_analyzed: "Geanalyseerde producten", avg_score: "Gemiddelde score", co2_per_product: "CO2 per product",
  available_of: "van {limit} beschikbaar", low: "Laag", medium: "Gemiddeld", high: "Hoog", very_high: "Zeer hoog",
  recalculate_all: "Alles herberekenen", products: "Producten", confidence: "Betrouwbaarheid",
  quota_usage: "Quotumgebruik", used: "gebruikt", modules: "Modules", product_catalog: "Productcatalogus",
  no_products: "Geen geanalyseerde producten", launch_analysis: "Analyse starten",

  low_impact: "Lage impact", moderate_impact: "Gemiddelde impact", high_impact: "Hoge impact", very_high_impact: "Zeer hoge impact",

  nav_analytics: "Trends", nav_reduce: "AI-tips", nav_dpp: "EU-paspoort", nav_reports: "RSE / CSRD",
  nav_compliance: "Green Claims", nav_abtest: "Optimaliseren", nav_roi: "Prestaties", nav_benchmark: "Sector",
  nav_scope3: "Toeleveringsketen", nav_impact: "Publiek portaal", nav_settings: "Config", nav_plans: "Prijzen",

  current_plan: "Huidig plan", free_forever: "voor altijd", per_month: "/maand", start_free: "Gratis beginnen",
  start_now: "Nu beginnen", downgrade: "Downgraden", popular: "Populair", recommended: "Aanbevolen",
  active: "Actief", free: "Gratis", unlimited: "Onbeperkt", faq: "Veelgestelde vragen",

  days_remaining: "dagen resterend", compliance_score: "Nalevingsscore", scan_my_store: "Mijn winkel scannen",
  scanning: "Scannen...", no_issues: "Geen problemen gedetecteerd", compliant: "Conform", to_improve: "Te verbeteren",
  non_compliant: "Niet conform", compliant_templates: "Conforme sjablonen", scan_history: "Scangeschiedenis",
  elements_analyzed: "elementen geanalyseerd", problems: "problemen",

  reduction_potential: "Geschat reductiepotentieel", commitments_taken: "Aangegane verplichtingen",
  potential_savings: "Potentiele besparingen", achieved_savings: "Aangegane besparingen", estimated_reduction: "Geschatte reductie",
  engagement_score: "Betrokkenheidsscore", commit: "Verplichten", remove: "Verwijderen", recommendations: "Aanbevelingen",
  suggestions: "suggesties", disclaimer_title: "Waarschuwing — Niet-geverifieerde schattingen",
  disclaimer_text: "De getoonde besparingen zijn schattingen op basis van ADEME-sectorgemiddelden. Ze vormen geen daadwerkelijke meting van reductie.",

  monthly_report: "Maandrapport", quarterly_report: "Kwartaalrapport", annual_report: "Jaarrapport",
  this_month: "Deze maand", this_quarter: "Dit kwartaal", this_year: "Dit jaar",
  generated_reports: "Gegenereerde rapporten", generated_on: "Gegenereerd op", footprint: "Voetafdruk",
  offset: "Gecompenseerd", net: "Netto", trees: "Bomen",

  generate_all_dpp: "Alle DPPs genereren", dpp_generated: "Gegenereerd", pending: "In afwachting",
  view_sheet: "Bekijk fiche", copy: "Kopieren", edit: "Bewerken", generate: "Genereren", save_regenerate: "Opslaan en DPP regenereren",
  origin_country: "Land van productie", durability_years: "Geschatte levensduur (jaren)",
  materials_composition: "Materiaalsamenstelling", recyclability: "Recycleerbaarheid", end_of_life: "Einde levensduur",
  care_instructions: "Verzorgingsinstructies", certifications: "Certificeringen", product_category: "Productcategorie",

  save: "Opslaan", cancel: "Annuleren", delete: "Verwijderen", export: "Exporteren", close: "Sluiten",
  loading: "Laden...", error: "Fout", success: "Succes",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

const ja: TranslationKeys = {
  dashboard: "ダッシュボード", analytics: "分析", reduce: "削減", dpp: "DPP", reports: "RSEレポート",
  compliance: "EU準拠", abtest: "A/Bテスト", roi: "ROI", benchmark: "ベンチマーク",
  scope3: "スコープ3", impact: "公開インパクト", settings: "設定", pricing: "プラン＆価格", plans: "プラン",

  products_analyzed: "分析済み製品", avg_score: "平均スコア", co2_per_product: "製品あたりCO2",
  available_of: "{limit}中利用可能", low: "低い", medium: "中程度", high: "高い", very_high: "非常に高い",
  recalculate_all: "全て再計算", products: "製品", confidence: "信頼度",
  quota_usage: "クォータ使用量", used: "使用済み", modules: "モジュール", product_catalog: "製品カタログ",
  no_products: "分析済み製品なし", launch_analysis: "分析開始",

  low_impact: "低インパクト", moderate_impact: "中程度のインパクト", high_impact: "高インパクト", very_high_impact: "非常に高いインパクト",

  nav_analytics: "トレンド", nav_reduce: "AIヒント", nav_dpp: "EUパスポート", nav_reports: "RSE / CSRD",
  nav_compliance: "グリーンクレーム", nav_abtest: "最適化", nav_roi: "パフォーマンス", nav_benchmark: "セクター",
  nav_scope3: "サプライチェーン", nav_impact: "公開ポータル", nav_settings: "設定", nav_plans: "価格",

  current_plan: "現在のプラン", free_forever: "永久無料", per_month: "/月", start_free: "無料で開始",
  start_now: "今すぐ開始", downgrade: "ダウングレード", popular: "人気", recommended: "おすすめ",
  active: "アクティブ", free: "無料", unlimited: "無制限", faq: "よくある質問",

  days_remaining: "日残り", compliance_score: "準拠スコア", scan_my_store: "ストアをスキャン",
  scanning: "スキャン中...", no_issues: "問題なし", compliant: "準拠", to_improve: "改善が必要",
  non_compliant: "非準拠", compliant_templates: "準拠テンプレート", scan_history: "スキャン履歴",
  elements_analyzed: "要素分析済み", problems: "問題",

  reduction_potential: "推定削減ポテンシャル", commitments_taken: "コミットメント",
  potential_savings: "潜在的な節約", achieved_savings: "コミット済みの節約", estimated_reduction: "推定削減",
  engagement_score: "エンゲージメントスコア", commit: "コミット", remove: "削除", recommendations: "推奨事項",
  suggestions: "提案", disclaimer_title: "警告 — 未検証の推定値",
  disclaimer_text: "表示されている節約はADEMEセクター平均に基づく推定値です。実際の削減測定ではありません。",

  monthly_report: "月次レポート", quarterly_report: "四半期レポート", annual_report: "年次レポート",
  this_month: "今月", this_quarter: "今四半期", this_year: "今年",
  generated_reports: "生成されたレポート", generated_on: "生成日", footprint: "フットプリント",
  offset: "オフセット済み", net: "ネット", trees: "植樹",

  generate_all_dpp: "全DPP生成", dpp_generated: "生成済み", pending: "保留中",
  view_sheet: "シートを見る", copy: "コピー", edit: "編集", generate: "生成", save_regenerate: "保存してDPP再生成",
  origin_country: "製造国", durability_years: "推定寿命（年）",
  materials_composition: "材料構成", recyclability: "リサイクル可能性", end_of_life: "使用終了",
  care_instructions: "お手入れ方法", certifications: "認証", product_category: "製品カテゴリー",

  save: "保存", cancel: "キャンセル", delete: "削除", export: "エクスポート", close: "閉じる",
  loading: "読み込み中...", error: "エラー", success: "成功",

  kg: "kg", kg_co2: "kg CO2", eur: "EUR",
};

// ── Translation map ──────────────────────────────────

const TRANSLATIONS: Record<Locale, TranslationKeys> = { en, fr, de, es, pt, it, nl, ja };

/**
 * Get translation function for a locale.
 * Usage: const t = getT("fr"); t("dashboard") → "Tableau de bord"
 */
export function getT(locale: Locale): (key: keyof TranslationKeys, params?: Record<string, string>) => string {
  const translations = TRANSLATIONS[locale] ?? TRANSLATIONS.en;
  return (key, params) => {
    let text = translations[key] ?? TRANSLATIONS.en[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  };
}
