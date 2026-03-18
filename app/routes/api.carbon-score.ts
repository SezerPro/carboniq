import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import type { CarbonLabel } from "@prisma/client";

const BADGE_MAP: Record<
  CarbonLabel,
  { color: string; bgColor: string; text: string; icon: string }
> = {
  LOW: { color: "#22c55e", bgColor: "#f0fdf4", text: "Faible impact", icon: "🌿" },
  MEDIUM: { color: "#f59e0b", bgColor: "#fffbeb", text: "Impact modéré", icon: "🍃" },
  HIGH: { color: "#f97316", bgColor: "#fff7ed", text: "Impact élevé", icon: "⚠️" },
  VERY_HIGH: { color: "#ef4444", bgColor: "#fef2f2", text: "Impact très élevé", icon: "🔴" },
};

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function silentResponse() {
  return new Response(
    JSON.stringify({ display: "none" }),
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const productId = url.searchParams.get("product_id");

  if (!shopDomain || !productId) {
    return silentResponse();
  }

  // Verify shop exists and plan is active
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    include: { subscription: true },
  });

  if (!shop) return silentResponse();

  const activeStatuses = ["TRIALING", "ACTIVE"];
  if (!activeStatuses.includes(shop.planStatus)) {
    return silentResponse();
  }

  // Find the product score
  const product = await prisma.product.findUnique({
    where: {
      shopId_shopifyProductId: {
        shopId: shop.id,
        shopifyProductId: productId,
      },
    },
  });

  if (!product || !product.carbonScoreKg || !product.carbonLabel) {
    return silentResponse();
  }

  const badge = BADGE_MAP[product.carbonLabel];

  return new Response(
    JSON.stringify({
      carbonScoreKg: product.carbonScoreKg,
      carbonLabel: product.carbonLabel,
      badge: {
        color: badge.color,
        bgColor: badge.bgColor,
        text: badge.text,
        icon: badge.icon,
      },
    }),
    { status: 200, headers: CORS_HEADERS },
  );
}
