import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  getActiveTest,
  assignVariant,
  recordImpression,
  recordConversion,
} from "../lib/abtest/abtest.server";

import { CORS_PUBLIC, getCorsWriteHeaders } from "../lib/security/api-auth.server";

/**
 * GET /api/abtest?shop=xxx&test_type=badge_style
 *
 * Returns the active A/B test variant for the given shop and test type.
 * Response: { testId, variant: "A"|"B", config: {...} }
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_PUBLIC });
  }

  // Verify App Proxy signature — shop comes from authenticated session, never trust ?shop= from URL
  let shopDomain: string;
  try {
    const { session } = await authenticate.public.appProxy(request);
    if (!session?.shop) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_PUBLIC });
    }
    shopDomain = session.shop;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_PUBLIC });
  }

  try {
    const url = new URL(request.url);
    const testType = url.searchParams.get("test_type");

    if (!testType) {
      return new Response(
        JSON.stringify({ error: "Missing test_type parameter" }),
        { status: 400, headers: CORS_PUBLIC },
      );
    }

    const shop = await prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Shop not found" }),
        { status: 404, headers: CORS_PUBLIC },
      );
    }

    const test = await getActiveTest(shop.id, testType);

    if (!test) {
      return new Response(
        JSON.stringify({ testId: null, variant: null, config: null }),
        { status: 200, headers: CORS_PUBLIC },
      );
    }

    const { variant, config } = assignVariant(test);

    return new Response(
      JSON.stringify({
        testId: test.id,
        variant,
        config,
      }),
      { status: 200, headers: CORS_PUBLIC },
    );
  } catch {
    // Silent failure — return empty result
    return new Response(
      JSON.stringify({ testId: null, variant: null, config: null }),
      { status: 200, headers: CORS_PUBLIC },
    );
  }
}

/**
 * POST /api/abtest
 *
 * Record an A/B test event (impression or conversion).
 * Body: { testId, variant, event: "impression"|"conversion", revenue? }
 */
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
    let body: {
      testId?: string;
      variant?: "A" | "B";
      event?: "impression" | "conversion";
      revenue?: number;
    };

    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers },
      );
    }

    const { testId, variant, event, revenue } = body as {
      testId?: string;
      variant?: "A" | "B";
      event?: "impression" | "conversion";
      revenue?: number;
    };

    if (!testId || !variant || !event) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: testId, variant, event" }),
        { status: 400, headers },
      );
    }

    // Cross-tenant guard: verify the test belongs to the authenticated shop
    const shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (shop) {
      const test = await prisma.aBTest.findUnique({ where: { id: testId } });
      if (test && test.shopId !== shop.id) {
        return new Response(
          JSON.stringify({ error: "Test does not belong to this shop" }),
          { status: 403, headers },
        );
      }
    }

    if (variant !== "A" && variant !== "B") {
      return new Response(
        JSON.stringify({ error: "variant must be A or B" }),
        { status: 400, headers },
      );
    }

    if (event !== "impression" && event !== "conversion") {
      return new Response(
        JSON.stringify({ error: "event must be impression or conversion" }),
        { status: 400, headers },
      );
    }

    if (event === "impression") {
      await recordImpression(testId, variant);
    } else {
      await recordConversion(testId, variant, revenue);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers },
    );
  } catch {
    // Silent failure — always return success to avoid breaking storefront
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers },
    );
  }
}
