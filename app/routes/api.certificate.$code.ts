import type { LoaderFunctionArgs } from "react-router";
import { getCertificateByCode } from "../lib/certificate/certificate.server";
import { logger } from "../lib/security/logger.server";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/**
 * GET /api/certificate/:code
 *
 * Public endpoint to view a certificate by its unique code.
 * Returns JSON with certificate data, shop name, and badge styling.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const code = params.code;

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Certificate code is required" }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const certificate = await getCertificateByCode(code);

  if (!certificate) {
    return new Response(
      JSON.stringify({ error: "Certificate not found" }),
      { status: 404, headers: CORS_HEADERS },
    );
  }

  // Audit: log access to protected customer data (masked email)
  logger.dataAccess("view_certificate", certificate.shop?.id ?? "unknown", "email", certificate.uniqueCode);

  return new Response(
    JSON.stringify({
      id: certificate.id,
      uniqueCode: certificate.uniqueCode,
      carbonKg: certificate.carbonKg,
      treesPlanted: certificate.treesPlanted,
      oceanKg: certificate.oceanKg,
      customerEmail: certificate.customerEmail
        ? certificate.customerEmail.replace(/^(.{2})(.*)(@.*)$/, "$1***$3")
        : null,
      orderName: certificate.orderName,
      createdAt: certificate.createdAt,
      qrCodeUrl: certificate.qrCodeUrl,
      pdfUrl: certificate.pdfUrl,
      offset: {
        id: certificate.offset.id,
        orderId: certificate.offset.orderId,
        status: certificate.offset.status,
        amountEur: certificate.offset.amountEur,
        carbonKg: certificate.offset.carbonKg,
      },
      shop: {
        name: certificate.shop.name,
        badgeStyle: certificate.shop.badgeStyle,
        badgeColor: certificate.shop.badgeColor,
      },
    }),
    { status: 200, headers: CORS_HEADERS },
  );
}
