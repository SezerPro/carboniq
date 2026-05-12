import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
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

  // Verify App Proxy signature — shop comes from authenticated session, never trust ?shop= from URL
  let shop: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
    }
    shop = session.shop;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const url = new URL(request.url);
    const itemsParam = url.searchParams.get("items");

    if (!itemsParam) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: items" }),
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
