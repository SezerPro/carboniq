import type { ActionFunctionArgs } from "react-router";
import { recordOffset } from "../lib/offset/checkout.server";
import { createCertificate } from "../lib/certificate/generator.server";
import { getCorsWriteHeaders, verifyApiRequest, checkRateLimit } from "../lib/security/api-auth.server";
import db from "../db.server";
import { isKlaviyoConfigured, syncCustomerToKlaviyo } from "../lib/klaviyo/klaviyo.server";

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

    // Verify shop + HMAC signature
    const bodyStr = JSON.stringify({ shop, orderId, orderName, customerEmail, carbonKg, amountEur });
    const verification = await verifyApiRequest(request, shop, {
      requireSignature: true,
      body: bodyStr,
    });
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

    // Fire-and-forget: sync to Klaviyo if configured
    void (async () => {
      try {
        const shopRecord = await db.shop.findUnique({ where: { id: verification.shopId! } });
        if (shopRecord && isKlaviyoConfigured(shopRecord)) {
          const totalOffsets = await db.carbonOffset.aggregate({
            where: { shopId: verification.shopId!, status: "COMPLETED" },
            _sum: { carbonKg: true },
            _count: true,
          });
          await syncCustomerToKlaviyo(
            shopRecord,
            customerEmail ?? "",
            orderName ?? "",
            {
              totalOffsetKg: totalOffsets._sum.carbonKg ?? 0,
              totalOrders: totalOffsets._count,
              lastOffsetDate: new Date().toISOString(),
            },
          );
        }
      } catch (e) {
        console.error("[offset-record] Klaviyo sync error (non-blocking):", e);
      }
    })();

    return new Response(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      JSON.stringify({ offsetId: offset.id, certificateCode: (certificate as any).uniqueCode, certificateUrl: `/api/certificate/${(certificate as any).uniqueCode}` }),
      { status: 201, headers },
    );
  } catch (error) {
    console.error("[offset-record] Error:", error);
    return new Response(JSON.stringify({ error: "Failed to record offset" }), { status: 500, headers });
  }
}
