import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function silentResponse() {
  return jsonResponse({ display: "none" });
}

function getCarbonLabel(scoreKg: number): string {
  if (scoreKg <= 1) return "A";
  if (scoreKg <= 3) return "B";
  if (scoreKg <= 6) return "C";
  if (scoreKg <= 10) return "D";
  return "E";
}

function getBadge(
  label: string,
): { text: string; color: string; bg: string } {
  switch (label) {
    case "A":
      return { text: "Excellent", color: "#16a34a", bg: "#dcfce7" };
    case "B":
      return { text: "Bon", color: "#65a30d", bg: "#ecfccb" };
    case "C":
      return { text: "Modéré", color: "#ca8a04", bg: "#fef9c3" };
    case "D":
      return { text: "Élevé", color: "#ea580c", bg: "#ffedd5" };
    case "E":
      return { text: "Très élevé", color: "#dc2626", bg: "#fee2e2" };
    default:
      return { text: "Non classé", color: "#6b7280", bg: "#f3f4f6" };
  }
}

function getEquivalents(
  scoreKg: number,
): Array<{ icon: string; text: string; value: string }> {
  const equivalents: Array<{ icon: string; text: string; value: string }> = [];

  // 1 km in car ~ 0.21 kg CO2
  const carKm = Math.round(scoreKg / 0.21);
  if (carKm > 0) {
    equivalents.push({
      icon: "\u{1F697}",
      text: "km en voiture",
      value: `${carKm} km`,
    });
  }

  // 1 hour of streaming ~ 0.036 kg CO2
  const streamingHours = Math.round(scoreKg / 0.036);
  if (streamingHours > 0) {
    equivalents.push({
      icon: "\u{1F4F1}",
      text: "heures de streaming vidéo",
      value: `${streamingHours}h`,
    });
  }

  // 1 meal ~ 2.5 kg CO2 average
  const meals = Math.round((scoreKg / 2.5) * 10) / 10;
  if (meals >= 0.1) {
    equivalents.push({
      icon: "\u{1F37D}\uFE0F",
      text: "repas standard",
      value: `${meals}`,
    });
  }

  // 1 tree absorbs ~22 kg CO2/year
  const treeDays = Math.round((scoreKg / 22) * 365);
  if (treeDays > 0) {
    equivalents.push({
      icon: "\u{1F333}",
      text: treeDays > 1 ? "jours d'absorption d'un arbre" : "jour d'absorption d'un arbre",
      value: `${treeDays} j`,
    });
  }

  return equivalents.slice(0, 3);
}

async function getComparison(
  scoreKg: number,
  categoryCode: string | null,
  shopId: string,
): Promise<{ text: string; icon: string } | null> {
  if (!categoryCode) return null;

  // Only compare within the same shop's products (no cross-tenant data leak)
  const categoryProducts = await prisma.product.findMany({
    where: {
      shopId,
      categoryCode,
      carbonScoreKg: { not: null },
    },
    select: { carbonScoreKg: true },
  });

  if (categoryProducts.length < 3) return null;

  const scores = categoryProducts
    .map((p) => p.carbonScoreKg!)
    .sort((a, b) => a - b);
  const betterThan = scores.filter((s) => s > scoreKg).length;
  const pct = Math.round((betterThan / scores.length) * 100);

  if (pct >= 50) {
    return {
      text: `Mieux que ${pct}% des produits similaires`,
      icon: "\u{1F3C6}",
    };
  }

  if (pct >= 25) {
    return {
      text: `Dans la moyenne des produits similaires`,
      icon: "\u{1F4CA}",
    };
  }

  return {
    text: `Des améliorations sont possibles`,
    icon: "\u{1F4A1}",
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Verify App Proxy signature — shop comes from authenticated session, never trust ?shop= from URL
  let shopDomain: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) return silentResponse();
    shopDomain = session.shop;
  } catch {
    return silentResponse();
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");

  if (!productId) {
    return silentResponse();
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) return silentResponse();

    const product = await prisma.product.findFirst({
      where: {
        shopId: shop.id,
        shopifyProductId: productId,
      },
    });

    if (!product || product.carbonScoreKg == null) {
      return silentResponse();
    }

    const scoreKg = product.carbonScoreKg;
    const carbonLabel = getCarbonLabel(scoreKg);
    const badge = getBadge(carbonLabel);
    const equivalents = getEquivalents(scoreKg);
    const comparison = await getComparison(scoreKg, product.categoryCode, shop.id);

    // Social proof: total offsets and customers for this shop
    const offsetAgg = await prisma.carbonOffset.aggregate({
      where: { shopId: shop.id },
      _sum: { carbonKg: true },
      _count: { id: true },
    });

    const socialProof = {
      totalOffsets: Math.round((offsetAgg._sum.carbonKg ?? 0) * 100) / 100,
      totalCustomers: offsetAgg._count.id,
    };

    // DPP availability
    const dpp = {
      available: !!product.dppGeneratedAt,
      url: product.dppQrCodeUrl
        ? `${product.dppQrCodeUrl}?shop=${encodeURIComponent(shopDomain)}`
        : null,
    };

    return jsonResponse({
      carbonScoreKg: Math.round(scoreKg * 100) / 100,
      carbonLabel,
      badge,
      equivalents,
      socialProof,
      comparison,
      dpp,
    });
  } catch {
    return silentResponse();
  }
}
