import type { LoaderFunctionArgs } from "react-router";
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

  const reportId = params.id;
  if (!reportId) {
    return silentResponse();
  }

  try {
    const report = await getReport(reportId);

    if (!report) {
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
