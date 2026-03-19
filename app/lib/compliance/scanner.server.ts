import prisma from "../../db.server";

// Banned terms and phrases per EU EmpCo directive
const BANNED_CLAIMS = [
  { pattern: /neutre?\s*(en)?\s*carbone/gi, severity: "critical", fix: "Remplacez par : 'Cette commande contribue à des projets de compensation carbone vérifiés'" },
  { pattern: /carbon\s*neutral/gi, severity: "critical", fix: "Replace with: 'This order contributes to verified carbon offset projects'" },
  { pattern: /z[ée]ro\s*[ée]mission/gi, severity: "critical", fix: "Aucun produit n'est réellement zéro émission. Utilisez : 'Émissions compensées à X%'" },
  { pattern: /zero\s*emission/gi, severity: "critical", fix: "No product is truly zero emission. Use: 'X% of emissions offset'" },
  { pattern: /100%?\s*(?:vert|green|[ée]cologique|ecological)/gi, severity: "high", fix: "Les claims absolues sont interdites sans preuve. Précisez : 'Fabriqué avec X% de matériaux recyclés'" },
  { pattern: /(?:respectueux|ami|friend)\s*(?:de\s*l['\u2019]environnement|of\s*the\s*environment)/gi, severity: "high", fix: "Trop vague. Précisez l'aspect environnemental exact." },
  { pattern: /eco[\s-]?friendly/gi, severity: "high", fix: "Too vague under EU law. Specify the exact environmental benefit." },
  { pattern: /(?:sans|no)\s*impact\s*(?:environnemental|environmental)/gi, severity: "critical", fix: "Tout produit a un impact. Utilisez des termes mesurables." },
  { pattern: /biod[ée]gradable/gi, severity: "medium", fix: "Précisez les conditions de biodégradation (milieu, durée, norme)" },
  { pattern: /compostable/gi, severity: "medium", fix: "Précisez : compostable industriel ou domestique, et la certification (EN 13432)" },
  { pattern: /durable|sustainable/gi, severity: "low", fix: "Mot trop générique. Précisez ce qui est durable exactement et fournissez des preuves." },
  { pattern: /plan[èe]te|planet/gi, severity: "info", fix: "Vérifiez que l'usage de ce terme n'implique pas une claim environnementale non prouvée" },
];

interface ComplianceFinding {
  term: string;
  context: string; // surrounding text
  severity: "critical" | "high" | "medium" | "low" | "info";
  suggestion: string;
  source: string; // product title, description, page URL, etc.
  sourceId?: string;
}

// Scan product titles and descriptions for banned claims
export async function scanShopCompliance(shopId: string, admin: any): Promise<{
  findings: ComplianceFinding[];
  totalProducts: number;
  totalIssues: number;
}> {
  const findings: ComplianceFinding[] = [];

  // Fetch products from Shopify GraphQL to get descriptions
  let hasNextPage = true;
  let cursor: string | null = null;
  let totalProducts = 0;

  while (hasNextPage) {
    const response = await admin.graphql(`#graphql
      query($cursor: String) {
        products(first: 50, after: $cursor) {
          edges {
            node {
              id
              title
              descriptionHtml
              tags
            }
            cursor
          }
          pageInfo { hasNextPage }
        }
      }
    `, { variables: { cursor } });

    const json = await response.json();
    const edges = json.data?.products?.edges ?? [];
    hasNextPage = json.data?.products?.pageInfo?.hasNextPage ?? false;

    for (const edge of edges) {
      const node = edge.node;
      cursor = edge.cursor;
      totalProducts++;

      const textsToScan = [
        { text: node.title, source: `Titre: ${node.title}`, sourceId: node.id },
        { text: node.descriptionHtml?.replace(/<[^>]*>/g, ' ') ?? '', source: `Description: ${node.title}`, sourceId: node.id },
        { text: (node.tags ?? []).join(' '), source: `Tags: ${node.title}`, sourceId: node.id },
      ];

      for (const { text, source, sourceId } of textsToScan) {
        if (!text) continue;
        for (const rule of BANNED_CLAIMS) {
          // Reset regex lastIndex before each use (since we use /g flag)
          rule.pattern.lastIndex = 0;
          const matches = text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags));
          for (const match of matches) {
            const start = Math.max(0, (match.index ?? 0) - 30);
            const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 30);
            findings.push({
              term: match[0],
              context: '...' + text.slice(start, end).trim() + '...',
              severity: rule.severity as ComplianceFinding["severity"],
              suggestion: rule.fix,
              source,
              sourceId,
            });
          }
        }
      }
    }
  }

  // Scan collections
  let collectionsCursor: string | null = null;
  let hasMoreCollections = true;
  while (hasMoreCollections) {
    const colResponse = await admin.graphql(`#graphql
      query($cursor: String) {
        collections(first: 50, after: $cursor) {
          edges { node { id title descriptionHtml } cursor }
          pageInfo { hasNextPage }
        }
      }
    `, { variables: { cursor: collectionsCursor } });
    const colJson = await colResponse.json();
    const colEdges = colJson.data?.collections?.edges ?? [];
    hasMoreCollections = colJson.data?.collections?.pageInfo?.hasNextPage ?? false;
    for (const edge of colEdges) {
      const node = edge.node;
      collectionsCursor = edge.cursor;
      totalProducts++;
      const texts = [
        { text: node.title, source: `Collection: ${node.title}`, sourceId: node.id },
        { text: node.descriptionHtml?.replace(/<[^>]*>/g, " ") ?? "", source: `Description collection: ${node.title}`, sourceId: node.id },
      ];
      for (const { text, source, sourceId } of texts) {
        if (!text) continue;
        for (const rule of BANNED_CLAIMS) {
          rule.pattern.lastIndex = 0;
          const matches = text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags));
          for (const match of matches) {
            const start = Math.max(0, (match.index ?? 0) - 30);
            const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 30);
            findings.push({ term: match[0], context: "..." + text.slice(start, end).trim() + "...", severity: rule.severity as ComplianceFinding["severity"], suggestion: rule.fix, source, sourceId });
          }
        }
      }
    }
  }

  // Scan CMS pages
  let pagesCursor: string | null = null;
  let hasMorePages = true;
  while (hasMorePages) {
    const pgResponse = await admin.graphql(`#graphql
      query($cursor: String) {
        pages(first: 50, after: $cursor) {
          edges { node { id title body } cursor }
          pageInfo { hasNextPage }
        }
      }
    `, { variables: { cursor: pagesCursor } });
    const pgJson = await pgResponse.json();
    const pgEdges = pgJson.data?.pages?.edges ?? [];
    hasMorePages = pgJson.data?.pages?.pageInfo?.hasNextPage ?? false;
    for (const edge of pgEdges) {
      const node = edge.node;
      pagesCursor = edge.cursor;
      totalProducts++;
      const texts = [
        { text: node.title, source: `Page: ${node.title}`, sourceId: node.id },
        { text: node.body?.replace(/<[^>]*>/g, " ") ?? "", source: `Contenu page: ${node.title}`, sourceId: node.id },
      ];
      for (const { text, source, sourceId } of texts) {
        if (!text) continue;
        for (const rule of BANNED_CLAIMS) {
          rule.pattern.lastIndex = 0;
          const matches = text.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags));
          for (const match of matches) {
            const start = Math.max(0, (match.index ?? 0) - 30);
            const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 30);
            findings.push({ term: match[0], context: "..." + text.slice(start, end).trim() + "...", severity: rule.severity as ComplianceFinding["severity"], suggestion: rule.fix, source, sourceId });
          }
        }
      }
    }
  }

  // Save scan result
  await prisma.complianceScan.create({
    data: {
      shopId,
      totalPages: totalProducts,
      totalIssues: findings.length,
      findings: JSON.stringify(findings),
    },
  });

  return { findings, totalProducts, totalIssues: findings.length };
}

// Get scan history for a shop
export async function getScanHistory(shopId: string, limit = 10) {
  return prisma.complianceScan.findMany({
    where: { shopId },
    orderBy: { scannedAt: "desc" },
    take: limit,
  });
}

// Get latest scan for a shop
export async function getLatestScan(shopId: string) {
  return prisma.complianceScan.findFirst({
    where: { shopId },
    orderBy: { scannedAt: 'desc' },
  });
}

// Get compliant claim templates
export function getCompliantTemplates(): Array<{ category: string; banned: string; compliant: string; explanation: string }> {
  return [
    { category: "Neutralite carbone", banned: "Ce produit est neutre en carbone", compliant: "Les emissions de ce produit (X kg CO2) sont compensees via des projets certifies Gold Standard", explanation: "L'UE interdit les claims de neutralite basees uniquement sur la compensation" },
    { category: "Ecologique", banned: "Produit ecologique / eco-friendly", compliant: "Fabrique avec 80% de coton biologique certifie GOTS", explanation: "Les claims doivent etre specifiques et verifiables" },
    { category: "Durable", banned: "Mode durable", compliant: "Duree de vie testee : 5 ans d'usage normal (norme ISO 12947)", explanation: "La durabilite doit etre quantifiable" },
    { category: "Recycle", banned: "Fait en materiaux recycles", compliant: "Contient 65% de polyester recycle post-consommation (certifie GRS)", explanation: "Preciser le % et la certification" },
    { category: "Biodegradable", banned: "Emballage biodegradable", compliant: "Emballage compostable en milieu industriel (EN 13432)", explanation: "Preciser les conditions de biodegradation" },
    { category: "Impact", banned: "Sans impact environnemental", compliant: "Empreinte carbone reduite de 40% par rapport a un produit equivalent conventionnel", explanation: "Tout produit a un impact, utilisez des comparaisons relatives" },
  ];
}
