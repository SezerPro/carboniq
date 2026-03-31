import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { hasAccess } from "../lib/plans/constants";
import type { PlanTier } from "../lib/plans/constants";
import { exportProductsCsv } from "../lib/export/csv.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const userPlan: PlanTier = shop.plan ?? "FREE";
  if (!hasAccess(userPlan, "STARTER")) {
    throw new Response("Plan Starter requis pour l'export", { status: 403 });
  }

  const csv = await exportProductsCsv(shop.id);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carboniq-products.csv"',
    },
  });
};
