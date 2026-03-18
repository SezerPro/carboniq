// Shopify Flow trigger helpers
// These functions send Flow triggers via the Shopify Flow API.

// Trigger: product.scored
export async function triggerProductScored(admin: any, product: { id: string; title: string; carbonScoreKg: number; carbonLabel: string; confidence: number }) {
  // Use admin.graphql to send a flow trigger
  // For now, just a placeholder that logs the trigger
  console.log(`[Flow] product.scored: ${product.title} → ${product.carbonScoreKg}kg (${product.carbonLabel})`);
}

// Trigger: offset.completed
export async function triggerOffsetCompleted(admin: any, offset: { orderId: string; carbonKg: number; amountEur: number; certificateCode: string }) {
  console.log(`[Flow] offset.completed: Order ${offset.orderId} → ${offset.carbonKg}kg`);
}

// Trigger: label.changed
export async function triggerLabelChanged(admin: any, product: { id: string; title: string; oldLabel: string; newLabel: string }) {
  console.log(`[Flow] label.changed: ${product.title} → ${product.oldLabel} → ${product.newLabel}`);
}

// Trigger: threshold.exceeded
export async function triggerThresholdExceeded(admin: any, data: { shopDomain: string; monthlyCarbon: number; threshold: number }) {
  console.log(`[Flow] threshold.exceeded: ${data.shopDomain} → ${data.monthlyCarbon}kg (threshold: ${data.threshold}kg)`);
}

// Action: auto-tag product with carbon label
export async function autoTagProduct(admin: any, shopifyProductId: string, carbonLabel: string) {
  const tag = `carboniq:${carbonLabel.toLowerCase()}`;
  try {
    await admin.graphql(`#graphql
      mutation addTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `, {
      variables: {
        id: shopifyProductId.startsWith("gid://") ? shopifyProductId : `gid://shopify/Product/${shopifyProductId}`,
        tags: [tag, "carboniq:scored"],
      },
    });
  } catch (error) {
    console.error(`[Flow] Failed to tag product ${shopifyProductId}:`, error);
  }
}
