import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { detectLocale, getT, type Locale } from "../lib/i18n/translations";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const acceptLanguage = request.headers.get("Accept-Language");
  const locale = detectLocale(acceptLanguage);

  return { apiKey: process.env.SHOPIFY_API_KEY || "", locale };
};

export default function App() {
  const { apiKey, locale } = useLoaderData<typeof loader>();
  const t = getT(locale as Locale);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">{t("dashboard")}</s-link>
        <s-link href="/app/analytics">{t("analytics")}</s-link>
        <s-link href="/app/reduction">{t("reduce")}</s-link>
        <s-link href="/app/dpp">{t("dpp")}</s-link>
        <s-link href="/app/reports">{t("reports")}</s-link>
        <s-link href="/app/compliance">{t("compliance")}</s-link>
        <s-link href="/app/settings">{t("settings")}</s-link>
        <s-link href="/app/pricing">{t("pricing")}</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
