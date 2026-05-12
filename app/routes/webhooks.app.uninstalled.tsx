import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Always attempt cleanup; if the webhook ran before, these statements are no-ops.

  // 1. Delete all OAuth sessions for this shop.
  await db.session.deleteMany({ where: { shop } });

  // 2. Mark the Shop record as cancelled and clear the access token, so a future
  //    reinstall starts from a clean state (new OAuth, new token, billing re-approval).
  //    We keep the row + tenant data so the merchant's history is preserved if they
  //    reinstall within the GDPR retention window. shop/redact (called 48h after
  //    uninstall by Shopify) will delete it permanently.
  try {
    await db.shop.update({
      where: { shopDomain: shop },
      data: {
        accessToken: "",
        planStatus: "CANCELED",
      },
    });
  } catch {
    // Shop row may not exist (uninstalled before first install completed); ignore.
  }

  console.log(`[app/uninstalled] Sessions cleared and shop ${shop} marked CANCELED`);

  return new Response();
};
