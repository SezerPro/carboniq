import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getReport } from "../lib/report/rse.server";

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

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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

  const reportId = params.id;
  if (!reportId) {
    return silentResponse();
  }

  try {
    const report = await getReport(reportId);
    if (!report) {
      return silentResponse();
    }

    // Cross-tenant protection: resolve the requesting shop's internal ID and compare with report.shopId
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop || report.shopId !== shop.id) {
      return silentResponse();
    }

    return new Response(
      JSON.stringify(report.data),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch {
    return silentResponse();
  }
}
