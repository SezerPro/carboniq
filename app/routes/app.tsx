import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import db from "../db.server";
import { detectLocale, getT, type Locale, SUPPORTED_LOCALES } from "../lib/i18n/translations";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Check if shop has a saved locale preference
  const shop = await db.shop.findUnique({
    where: { shopDomain: session.shop },
    select: { locale: true },
  });

  let locale: Locale;
  if (shop?.locale && shop.locale !== "auto" && SUPPORTED_LOCALES.includes(shop.locale as Locale)) {
    locale = shop.locale as Locale;
  } else {
    locale = detectLocale(request.headers.get("Accept-Language"));
  }

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
