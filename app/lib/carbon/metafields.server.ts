import type { CarbonLabel } from "@prisma/client";
import type { AdminApi } from "../../shopify.server";

// ── Grade mapping ─────────────────────────────────────

const LABEL_TO_GRADE: Record<CarbonLabel, string> = {
  LOW: "A",
  MEDIUM: "B",
  HIGH: "C",
  VERY_HIGH: "D",
};

// ── Metafield sync ────────────────────────────────────

/**
 * Syncs CO₂ score data to Shopify product metafields.
 * Non-blocking: logs errors but never throws.
 */
export async function syncProductMetafield(
  admin: AdminApi,
  shopifyGid: string,
  carbonScoreKg: number,
  carbonLabel: CarbonLabel,
  categoryCode: string | null,
) {
  try {
    const grade = LABEL_TO_GRADE[carbonLabel] ?? "D";

    const metafields = [
      {
        ownerId: shopifyGid,
        namespace: "carboniq",
        key: "co2_score",
        type: "number_decimal",
        value: String(carbonScoreKg),
      },
      {
        ownerId: shopifyGid,
        namespace: "carboniq",
        key: "co2_label",
        type: "single_line_text_field",
        value: carbonLabel,
      },
      {
        ownerId: shopifyGid,
        namespace: "carboniq",
        key: "co2_grade",
        type: "single_line_text_field",
        value: grade,
      },
    ];

    if (categoryCode) {
      metafields.push({
        ownerId: shopifyGid,
        namespace: "carboniq",
        key: "co2_category",
        type: "single_line_text_field",
        value: categoryCode,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await admin.graphql(
      `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { metafields } },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await response.json();
    const userErrors = json.data?.metafieldsSet?.userErrors ?? [];

    if (userErrors.length > 0) {
      console.error(
        `Metafield sync errors for ${shopifyGid}:`,
        JSON.stringify(userErrors),
      );
    } else {
      console.log(
        `Metafields synced for ${shopifyGid}: score=${carbonScoreKg}, grade=${grade}`,
      );
    }
  } catch (error) {
    console.error(`Failed to sync metafields for ${shopifyGid}:`, error);
  }
}
