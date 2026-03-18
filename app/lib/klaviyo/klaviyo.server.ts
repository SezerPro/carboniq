const KLAVIYO_BASE_URL = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2024-10-15";

interface ShopWithKlaviyo {
  klaviyoApiKey?: string | null;
  klaviyoListId?: string | null;
}

interface ImpactData {
  totalOffsetKg: number;
  totalOrders: number;
  lastOffsetDate?: string;
}

interface OffsetEventData {
  carbonKg: number;
  amountEur: number;
  orderId?: string;
  certificateCode?: string;
}

// ── Check if Klaviyo is configured ────────────────────

export function isKlaviyoConfigured(shop: ShopWithKlaviyo): boolean {
  return Boolean(shop.klaviyoApiKey && shop.klaviyoApiKey.length > 0);
}

// ── Sync customer profile to Klaviyo ──────────────────

export async function syncCustomerToKlaviyo(
  shop: ShopWithKlaviyo,
  customerEmail: string,
  customerName: string,
  impactData: ImpactData,
): Promise<{ success: boolean; error?: string }> {
  if (!isKlaviyoConfigured(shop)) {
    return { success: false, error: "Klaviyo not configured" };
  }

  const apiKey = shop.klaviyoApiKey!;

  try {
    const [firstName, ...rest] = customerName.split(" ");
    const lastName = rest.join(" ") || undefined;

    const response = await fetch(`${KLAVIYO_BASE_URL}/profile-import/`, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "profile",
          attributes: {
            email: customerEmail,
            first_name: firstName,
            last_name: lastName,
            properties: {
              carboniq_total_offset_kg: impactData.totalOffsetKg,
              carboniq_total_orders: impactData.totalOrders,
              carboniq_is_eco_customer: impactData.totalOrders > 0,
              carboniq_last_offset_date:
                impactData.lastOffsetDate ?? new Date().toISOString(),
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[Klaviyo] syncCustomerToKlaviyo failed (${response.status}):`,
        body,
      );
      return { success: false, error: `Klaviyo API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("[Klaviyo] syncCustomerToKlaviyo error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ── Track offset event in Klaviyo ─────────────────────

export async function trackOffsetEvent(
  shop: ShopWithKlaviyo,
  customerEmail: string,
  offsetData: OffsetEventData,
): Promise<{ success: boolean; error?: string }> {
  if (!isKlaviyoConfigured(shop)) {
    return { success: false, error: "Klaviyo not configured" };
  }

  const apiKey = shop.klaviyoApiKey!;

  try {
    const response = await fetch(`${KLAVIYO_BASE_URL}/events/`, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: KLAVIYO_REVISION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: {
              data: {
                type: "metric",
                attributes: {
                  name: "Carboniq Offset",
                },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email: customerEmail,
                },
              },
            },
            properties: {
              carbonKg: offsetData.carbonKg,
              amountEur: offsetData.amountEur,
              orderId: offsetData.orderId ?? null,
              certificateCode: offsetData.certificateCode ?? null,
            },
            time: new Date().toISOString(),
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[Klaviyo] trackOffsetEvent failed (${response.status}):`,
        body,
      );
      return { success: false, error: `Klaviyo API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error("[Klaviyo] trackOffsetEvent error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
