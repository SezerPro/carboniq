import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { hasAccess } from "../lib/plans/constants";
import type { PlanTier } from "../lib/plans/constants";
import { generateReportPdf } from "../lib/export/pdf.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const reportId = params.id;

  if (!reportId) {
    throw new Response("Report ID required", { status: 400 });
  }

  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  const userPlan: PlanTier = shop.plan ?? "FREE";
  if (!hasAccess(userPlan, "STARTER")) {
    throw new Response("Plan Starter requis pour l'export PDF", {
      status: 403,
    });
  }

  // Verify report belongs to this shop
  const report = await db.rSEReport.findUnique({
    where: { id: reportId },
  });

  if (!report || report.shopId !== shop.id) {
    throw new Response("Report not found", { status: 404 });
  }

  const pdfBuffer = await generateReportPdf(reportId);

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="carboniq-report-${report.period.toLowerCase()}.pdf"`,
    },
  });
};
