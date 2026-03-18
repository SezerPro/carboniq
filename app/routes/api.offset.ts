import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import {
  calculateOffsetCost,
  createOffset,
  getOrderOffset,
} from "../lib/offset/offset.server";
import { generateCertificate } from "../lib/certificate/certificate.server";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/**
 * GET /api/offset?shop=xxx&order_id=xxx
 *
 * Retrieve the offset (and certificate) for a given order.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const orderId = url.searchParams.get("order_id");

  if (!shopDomain || !orderId) {
    return new Response(
      JSON.stringify({ error: "Missing shop or order_id parameter" }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    return new Response(
      JSON.stringify({ error: "Shop not found" }),
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const offset = await getOrderOffset(shop.id, orderId);

  if (!offset) {
    return new Response(
      JSON.stringify({ error: "Offset not found for this order" }),
      { status: 404, headers: CORS_HEADERS },
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
    { status: 200, headers: CORS_HEADERS },
  );
}

/**
 * POST /api/offset
 *
 * Create a carbon offset for a checkout.
 * Body: { shop, orderId, orderName, customerEmail, carbonKg }
 */
export async function action({ request }: ActionFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: CORS_HEADERS },
    );
  }

  let body: {
    shop?: string;
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
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const { shop: shopDomain, orderId, orderName, customerEmail, carbonKg } = body;

  if (!shopDomain || !orderId || !carbonKg) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: shop, orderId, carbonKg" }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Find shop by domain
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    return new Response(
      JSON.stringify({ error: "Shop not found" }),
      { status: 404, headers: CORS_HEADERS },
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
    { status: 201, headers: CORS_HEADERS },
  );
}
