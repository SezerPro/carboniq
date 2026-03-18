import db from "../../db.server";

interface CategorizationResult {
  categoryCode: string;
  confidence: number;
  reasoning: string;
}

// Material detection patterns
const MATERIAL_PATTERNS = [
  { pattern: /\b(coton|cotton)\b/i, category: "textile", weight: 0.8 },
  { pattern: /\b(polyester|nylon|spandex|lycra)\b/i, category: "textile", weight: 0.7 },
  { pattern: /\b(cuir|leather)\b/i, category: "textile.chaussures", weight: 0.6 },
  { pattern: /\b(bois|wood|chêne|oak|pin|pine)\b/i, category: "furniture.wood", weight: 0.8 },
  { pattern: /\b(plastique|plastic|abs|pvc)\b/i, category: "toys.plastic", weight: 0.5 },
  { pattern: /\b(acier|steel|métal|metal|aluminium|aluminum)\b/i, category: "generic.default", weight: 0.4 },
  { pattern: /\b(bio|organic|biologique)\b/i, category: null, weight: 0.3 },
  { pattern: /\b(recyclé|recycled)\b/i, category: null, weight: 0.3 },
];

// Category patterns
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; code: string; weight: number }> = [
  // Textile
  { pattern: /\b(t-?shirt|tee|polo|top|haut|chemise|blouse)\b/i, code: "textile.tshirt", weight: 0.9 },
  { pattern: /\b(jeans?|denim|pantalon|pants?|trousers?|chino|short)\b/i, code: "textile.jeans", weight: 0.9 },
  { pattern: /\b(manteau|coat|veste|jacket|blouson|parka|doudoune|hoodie|sweat)\b/i, code: "textile.manteau", weight: 0.9 },
  { pattern: /\b(chaussure|shoe|sneaker|boots?|sandal|basket|mocassin|escarpin)\b/i, code: "textile.chaussures", weight: 0.9 },
  { pattern: /\b(robe|dress|jupe|skirt)\b/i, code: "textile.tshirt", weight: 0.7 },
  { pattern: /\b(sous-vêtement|underwear|lingerie|sock|chaussette)\b/i, code: "textile.tshirt", weight: 0.6 },
  // Electronics
  { pattern: /\b(smartphone|phone|iphone|samsung|mobile|téléphone|cellulaire)\b/i, code: "electronics.smartphone", weight: 0.95 },
  { pattern: /\b(laptop|ordinateur|computer|macbook|notebook|chromebook|pc\b)/i, code: "electronics.laptop", weight: 0.95 },
  { pattern: /\b(casque|headphone|écouteur|earphone|earbud|airpod)\b/i, code: "electronics.headphones", weight: 0.9 },
  { pattern: /\b(tablet|tablette|ipad)\b/i, code: "electronics.laptop", weight: 0.7 },
  { pattern: /\b(montre|watch|smartwatch)\b/i, code: "electronics.smartphone", weight: 0.5 },
  // Food
  { pattern: /\b(boeuf|beef|steak|viande|meat|burger|boucherie)\b/i, code: "food.beef", weight: 0.9 },
  { pattern: /\b(chocolat|chocolate|cacao|cocoa|truffe)\b/i, code: "food.chocolate", weight: 0.9 },
  { pattern: /\b(café|coffee|espresso|capsule|nespresso)\b/i, code: "food.coffee", weight: 0.9 },
  { pattern: /\b(thé|tea|infusion|matcha)\b/i, code: "food.coffee", weight: 0.6 },
  // Furniture
  { pattern: /\b(meuble|furniture|table|chaise|chair|bureau|desk|étagère|shelf|canapé|sofa|lit|bed)\b/i, code: "furniture.wood", weight: 0.8 },
  // Beauty
  { pattern: /\b(soin|skincare|crème|cream|sérum|serum|lotion|huile|oil|masque|mask|maquillage|makeup|cosmétique)\b/i, code: "beauty.skincare", weight: 0.85 },
  { pattern: /\b(parfum|perfume|fragrance|cologne)\b/i, code: "beauty.skincare", weight: 0.6 },
  // Sports
  { pattern: /\b(vélo|bike|bicycle|vtt|bmx|cycling)\b/i, code: "sports.bike", weight: 0.9 },
  { pattern: /\b(yoga|fitness|sport|gym|exercise)\b/i, code: "generic.default", weight: 0.3 },
  // Books
  { pattern: /\b(livre|book|roman|novel|magazine|bd|manga|comics?)\b/i, code: "books.book", weight: 0.9 },
  // Toys
  { pattern: /\b(jouet|toy|jeu|game|peluche|plush|figurine|lego|puzzle)\b/i, code: "toys.plastic", weight: 0.8 },
  { pattern: /\b(enfant|kid|bébé|baby|children)\b/i, code: "toys.plastic", weight: 0.3 },
];

// AI categorization function — analyzes title, description, type, tags, vendor
export async function aiCategorize(product: {
  title: string;
  description?: string | null;
  product_type?: string | null;
  tags?: string | null;
  vendor?: string | null;
}): Promise<CategorizationResult> {
  const searchText = [
    product.title,
    product.description,
    product.product_type,
    product.tags,
    product.vendor,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Score each category
  const scores = new Map<string, { score: number; reasons: string[] }>();

  for (const rule of CATEGORY_PATTERNS) {
    if (rule.pattern.test(searchText)) {
      const entry = scores.get(rule.code) ?? { score: 0, reasons: [] };
      entry.score += rule.weight;
      entry.reasons.push(`Match: ${rule.pattern.source}`);
      scores.set(rule.code, entry);
    }
  }

  // Also check product_type as a strong signal
  if (product.product_type) {
    const type = product.product_type.toLowerCase();
    for (const rule of CATEGORY_PATTERNS) {
      if (rule.pattern.test(type)) {
        const entry = scores.get(rule.code) ?? { score: 0, reasons: [] };
        entry.score += rule.weight * 1.5; // product_type is a strong signal
        entry.reasons.push(`Product type match: ${type}`);
        scores.set(rule.code, entry);
      }
    }
  }

  // Detect materials and boost relevant categories
  for (const mat of MATERIAL_PATTERNS) {
    if (mat.pattern.test(searchText) && mat.category) {
      const entry = scores.get(mat.category) ?? { score: 0, reasons: [] };
      entry.score += mat.weight * 0.5;
      entry.reasons.push(`Material: ${mat.pattern.source}`);
      scores.set(mat.category, entry);
    }
  }

  // Find best match
  let bestCode = "generic.default";
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const [code, data] of scores) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestCode = code;
      bestReasons = data.reasons;
    }
  }

  // Normalize confidence to 0-1
  const confidence = Math.min(1, bestScore / 2);

  return {
    categoryCode: bestCode,
    confidence: Math.round(confidence * 100) / 100,
    reasoning:
      bestReasons.length > 0
        ? bestReasons.join("; ")
        : "Aucun pattern detecte, categorie generique",
  };
}

// Auto-categorize all products in a shop using AI
export async function aiCategorizeShop(
  shopId: string,
  admin: any,
): Promise<{
  categorized: number;
  improved: number;
  details: Array<{
    title: string;
    oldCategory: string | null;
    newCategory: string;
    confidence: number;
  }>;
}> {
  let hasNextPage = true;
  let cursor: string | null = null;
  let categorized = 0;
  let improved = 0;
  const details: Array<{
    title: string;
    oldCategory: string | null;
    newCategory: string;
    confidence: number;
  }> = [];

  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
      query($cursor: String) {
        products(first: 50, after: $cursor) {
          edges {
            node {
              id
              title
              descriptionHtml
              productType
              tags
              vendor
            }
            cursor
          }
          pageInfo { hasNextPage }
        }
      }
    `,
      { variables: { cursor } },
    );

    const json = await response.json();
    const edges = json.data?.products?.edges ?? [];
    hasNextPage = json.data?.products?.pageInfo?.hasNextPage ?? false;

    for (const edge of edges) {
      const node = edge.node;
      cursor = edge.cursor;
      const numericId = (node.id as string).split("/").pop() ?? node.id;

      const result = await aiCategorize({
        title: node.title,
        description: node.descriptionHtml?.replace(/<[^>]*>/g, " "),
        product_type: node.productType,
        tags: (node.tags ?? []).join(", "),
        vendor: node.vendor,
      });

      // Check if this product exists in our DB
      const existing = await db.product.findFirst({
        where: { shopId, shopifyProductId: numericId },
      });

      if (existing) {
        // Only update if AI has higher confidence or product was generic
        if (
          !existing.categoryCode ||
          existing.categoryCode === "generic.default" ||
          result.confidence > (existing.confidence ?? 0)
        ) {
          const oldCat = existing.categoryCode;
          await db.product.update({
            where: { id: existing.id },
            data: { categoryCode: result.categoryCode },
          });
          if (oldCat !== result.categoryCode) improved++;
          details.push({
            title: node.title,
            oldCategory: oldCat,
            newCategory: result.categoryCode,
            confidence: result.confidence,
          });
        }
      }
      categorized++;
    }
  }

  return { categorized, improved, details };
}
