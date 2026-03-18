import type { LoaderFunctionArgs } from "react-router";
import { calculateOffsetForOrder } from "../lib/offset/checkout.server";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const itemsParam = url.searchParams.get("items");

    if (!shop || !itemsParam) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: shop, items" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    let items: Array<{ productId: string; quantity: number }>;
    try {
      items = JSON.parse(itemsParam);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid items JSON" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ totalCarbonKg: 0, offsetCostEur: 0, breakdown: [], equivalents: {} }),
        { status: 200, headers: CORS_HEADERS },
      );
    }

    const result = await calculateOffsetForOrder(shop, items);

    const equivalents = {
      carKm: Math.round(result.totalCarbonKg * 6.2),
      flights: +(result.totalCarbonKg / 255).toFixed(2),
      treeDays: Math.round(result.totalCarbonKg * 16.5),
      smartphoneCharges: Math.round(result.totalCarbonKg * 122),
    };

    return new Response(
      JSON.stringify({
        totalCarbonKg: result.totalCarbonKg,
        offsetCostEur: result.offsetCostEur,
        breakdown: result.breakdown,
        equivalents,
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("[offset-calculate] Error:", error);
    return new Response(
      JSON.stringify({ totalCarbonKg: 0, offsetCostEur: 0, breakdown: [], equivalents: {} }),
      { status: 200, headers: CORS_HEADERS },
    );
  }
}
