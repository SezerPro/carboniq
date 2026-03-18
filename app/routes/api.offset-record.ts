import type { ActionFunctionArgs } from "react-router";
import { recordOffset } from "../lib/offset/checkout.server";
import { createCertificate } from "../lib/certificate/generator.server";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const body = await request.json();
    const { shop, orderId, orderName, customerEmail, carbonKg, amountEur } = body as {
      shop?: string;
      orderId?: string;
      orderName?: string;
      customerEmail?: string;
      carbonKg?: number;
      amountEur?: number;
    };

    if (!shop || !orderId || carbonKg == null || amountEur == null) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: shop, orderId, carbonKg, amountEur" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const offset = await recordOffset({
      shopId: shop,
      orderId,
      orderName,
      customerEmail,
      carbonKg,
      amountEur,
    });

    const certificate = await createCertificate(offset.id);

    return new Response(
      JSON.stringify({
        offsetId: offset.id,
        certificateCode: certificate.code,
        certificateUrl: `/api/certificate/${certificate.code}`,
      }),
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("[offset-record] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to record offset" }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
