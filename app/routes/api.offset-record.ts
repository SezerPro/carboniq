import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { recordOffset } from "../lib/offset/checkout.server";
import { createCertificate } from "../lib/certificate/generator.server";
import { getCorsWriteHeaders, checkRateLimit } from "../lib/security/api-auth.server";
import db from "../db.server";
import { isKlaviyoConfigured, syncCustomerToKlaviyo } from "../lib/klaviyo/klaviyo.server";
import { logger } from "../lib/security/logger.server";

export async function action({ request }: ActionFunctionArgs) {
  const headers = getCorsWriteHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
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

  try {
    const body = await request.json();
    const { orderId, orderName, customerEmail, carbonKg, amountEur } = body as {
      orderId?: string; orderName?: string;
      customerEmail?: string; carbonKg?: number; amountEur?: number;
    };

    if (!orderId || carbonKg == null || amountEur == null) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers });
    }

    // Rate limit per shop
    const rl = checkRateLimit(`offset-record:${shopDomain}`, "write");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers });
    }

    // Resolve the authenticated shop's internal ID
    const shopRecord = await db.shop.findUnique({ where: { shopDomain } });
    if (!shopRecord) {
      return new Response(JSON.stringify({ error: "Shop not found" }), { status: 404, headers });
    }

    const offset = await recordOffset({
      shopId: shopRecord.id,
      orderId,
      orderName,
      customerEmail,
      carbonKg,
      amountEur,
    });

    // Audit: log access to protected customer data
    logger.dataAccess("create_offset_certificate", shopRecord.id, "email", orderId);

    const certificate = await createCertificate(offset.id);

    // Fire-and-forget: sync to Klaviyo if configured
    void (async () => {
      try {
        if (isKlaviyoConfigured(shopRecord)) {
          const totalOffsets = await db.carbonOffset.aggregate({
            where: { shopId: shopRecord.id, status: "COMPLETED" },
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
