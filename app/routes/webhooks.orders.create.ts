import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { recordOffset } from "../lib/offset/checkout.server";
import { createCertificate } from "../lib/certificate/generator.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Check if the order contains a carbon offset opt-in
  const noteAttrs: Array<{ name: string; value: string }> =
    payload.note_attributes || [];
  const offsetAttr = noteAttrs.find(
    (a: { name: string }) => a.name === "carboniq_offset",
  );
  const isOffset = offsetAttr?.value === "true";

  if (!isOffset) {
    console.log(
      `[orders/create] Order ${payload.name ?? payload.id} has no carbon offset opt-in, skipping`,
    );
    return new Response();
  }

  // Extract offset data from note attributes
  const carbonKgAttr = noteAttrs.find(
    (a: { name: string }) => a.name === "carboniq_offset_kg",
  );
  const amountEurAttr = noteAttrs.find(
    (a: { name: string }) => a.name === "carboniq_offset_eur",
  );

  const carbonKg = carbonKgAttr ? parseFloat(carbonKgAttr.value) : 0;
  const amountEur = amountEurAttr ? parseFloat(amountEurAttr.value) : 0;

  if (carbonKg <= 0 || amountEur <= 0) {
    console.log(
      `[orders/create] Order ${payload.name ?? payload.id} has invalid offset values (kg=${carbonKg}, eur=${amountEur}), skipping`,
    );
    return new Response();
  }

  // Find the shop record
  const shopRecord = await db.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    console.log(`Shop ${shop} not found, skipping orders/create webhook`);
    return new Response();
  }

  try {
    const orderId = String(payload.id);
    const orderName = payload.name ?? "";
    const customerEmail =
      payload.email ??
      (payload.customer
        ? `${payload.customer.first_name ?? ""} ${payload.customer.last_name ?? ""}`.trim()
        : "");

    // Record the offset
    const offset = await recordOffset({
      shopId: shopRecord.id,
      orderId,
      orderName,
      customerEmail,
      carbonKg,
      amountEur,
    });

    console.log(
      `[orders/create] Offset recorded for order ${orderName}: ${carbonKg}kg CO₂, ${amountEur}€`,
    );

    // Generate the certificate
    const certificate = await createCertificate(offset.id);
    console.log(
      `[orders/create] Certificate ${certificate.uniqueCode} created for order ${orderName}`,
    );
  } catch (error) {
    console.error(
      `[orders/create] Failed to process offset for order ${payload.name ?? payload.id}:`,
      error,
    );
  }

  return new Response();
};
