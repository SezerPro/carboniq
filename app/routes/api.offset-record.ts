import type { ActionFunctionArgs } from "react-router";
import { recordOffset } from "../lib/offset/checkout.server";
import { createCertificate } from "../lib/certificate/generator.server";
import { getCorsWriteHeaders, verifyApiRequest, checkRateLimit } from "../lib/security/api-auth.server";

export async function action({ request }: ActionFunctionArgs) {
  const headers = getCorsWriteHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = await request.json();
    const { shop, orderId, orderName, customerEmail, carbonKg, amountEur } = body as {
      shop?: string; orderId?: string; orderName?: string;
      customerEmail?: string; carbonKg?: number; amountEur?: number;
    };

    if (!shop || !orderId || carbonKg == null || amountEur == null) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
    }

    // Rate limit
    const rl = checkRateLimit(`offset-record:${shop}`, "write");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers });
    }

    // Verify shop
    const verification = await verifyApiRequest(request, shop);
    if (!verification.valid) {
      return new Response(JSON.stringify({ error: verification.error }), { status: 403, headers });
    }

    const offset = await recordOffset({
      shopId: verification.shopId!,
      orderId,
      orderName,
      customerEmail,
      carbonKg,
      amountEur,
    });

    const certificate = await createCertificate(offset.id);

    return new Response(
      JSON.stringify({ offsetId: offset.id, certificateCode: (certificate as any).uniqueCode, certificateUrl: `/api/certificate/${(certificate as any).uniqueCode}` }),
      { status: 201, headers },
    );
  } catch (error) {
    console.error("[offset-record] Error:", error);
    return new Response(JSON.stringify({ error: "Failed to record offset" }), { status: 500, headers });
  }
}
