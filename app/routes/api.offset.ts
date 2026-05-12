import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  calculateOffsetCost,
  createOffset,
  getOrderOffset,
} from "../lib/offset/offset.server";
import { generateCertificate } from "../lib/certificate/certificate.server";
import { getCorsWriteHeaders, checkRateLimit } from "../lib/security/api-auth.server";

/**
 * GET /api/offset?shop=xxx&order_id=xxx
 *
 * Retrieve the offset (and certificate) for a given order.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const headers = getCorsWriteHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Verify App Proxy signature — shop comes from authenticated session, never trust ?shop= from URL
  let shopDomain: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    shopDomain = session.shop;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");

  if (!orderId) {
    return new Response(JSON.stringify({ error: "Missing order_id parameter" }), { status: 400, headers });
  }

  // Rate limit
  const rl = checkRateLimit(`offset-read:${shopDomain}`, "read");
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers });
  }

  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) {
    return new Response(JSON.stringify({ error: "Shop not found" }), { status: 404, headers });
  }

  const offset = await getOrderOffset(shop.id, orderId);

  if (!offset) {
    return new Response(
      JSON.stringify({ error: "Offset not found for this order" }),
      { status: 404, headers: headers },
    );
  }

  return new Response(
    JSON.stringify({
      offsetId: offset.id,
      orderId: offset.orderId,
      orderName: offset.orderName,
      carbonKg: offset.carbonKg,
      amountEur: offset.amountEur,
      status: offset.status,
      createdAt: offset.createdAt,
      certificate: offset.certificate
        ? {
            id: offset.certificate.id,
            uniqueCode: offset.certificate.uniqueCode,
            carbonKg: offset.certificate.carbonKg,
            treesPlanted: offset.certificate.treesPlanted,
            oceanKg: offset.certificate.oceanKg,
          }
        : null,
    }),
    { status: 200, headers: headers },
  );
}

/**
 * POST /api/offset
 *
 * Create a carbon offset for a checkout.
 * Body: { shop, orderId, orderName, customerEmail, carbonKg }
 */
export async function action({ request }: ActionFunctionArgs) {
  const headers = getCorsWriteHeaders(request);
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: headers });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: headers },
    );
  }

  // Verify App Proxy signature — shop comes from authenticated session, never trust shop in body
  let shopDomain: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    }
    shopDomain = session.shop;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: {
    orderId?: string;
    orderName?: string;
    customerEmail?: string;
    carbonKg?: number;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: headers },
    );
  }

  const { orderId, orderName, customerEmail, carbonKg } = body;

  if (!orderId || !carbonKg) {
    return new Response(JSON.stringify({ error: "Missing required fields: orderId, carbonKg" }), { status: 400, headers });
  }

  // Rate limit writes
  const rl = checkRateLimit(`offset-write:${shopDomain}`, "write");
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers });
  }

  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) {
    return new Response(
      JSON.stringify({ error: "Shop not found" }),
      { status: 404, headers: headers },
    );
  }

  // Calculate cost
  const amountEur = await calculateOffsetCost(carbonKg, shop);

  // Create offset record
  const offset = await createOffset(
    shop.id,
    orderId,
    orderName ?? "",
    customerEmail ?? "",
    carbonKg,
    amountEur,
  );

  // Generate certificate
  const certificate = await generateCertificate(offset.id);

  return new Response(
    JSON.stringify({
      offsetId: offset.id,
      certificateCode: certificate.uniqueCode,
      amountEur,
    }),
    { status: 201, headers: headers },
  );
}
