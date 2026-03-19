import { useRouteLoaderData } from "react-router";
import { getT, type Locale } from "./translations";

/**
 * Hook to get translations in any component.
 * Reads locale from the app layout loader data.
 * Falls back to "en" if not available.
 */
export function useTranslation() {
  const data = useRouteLoaderData("routes/app") as { locale?: string } | undefined;
  const locale = (data?.locale ?? "en") as Locale;
  return { t: getT(locale), locale };
}
