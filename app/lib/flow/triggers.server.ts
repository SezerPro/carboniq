// Shopify Flow trigger helpers
// These functions tag products/orders via GraphQL as fire-and-forget actions.
// All functions wrap in try/catch and never throw — safe for webhook context.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/**
 * Trigger: product.scored
 * Tags the product with "carboniq-scored" and the label tag (e.g. "carboniq:low").
 */
export async function triggerProductScored(
  admin: AdminClient,
  productGid: string,
  score: number,
  label: string,
) {
  try {
    const gid = productGid.startsWith("gid://")
      ? productGid
      : `gid://shopify/Product/${productGid}`;
    const labelTag = `carboniq:${label.toLowerCase()}`;

    await admin.graphql(
      `#graphql
      mutation addTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          id: gid,
          tags: ["carboniq-scored", labelTag],
        },
      },
    );

    console.log(
      `[Flow] product.scored: ${gid} → ${score}kg (${label})`,
    );
  } catch (error) {
    console.error(`[Flow] triggerProductScored failed:`, error);
  }
}

/**
 * Trigger: offset.completed
 * Tags the order with "carboniq-offset".
 * NOTE: Only usable in contexts where admin GraphQL is available (webhooks).
 */
export async function triggerOffsetCompleted(
  admin: AdminClient,
  orderId: string,
  carbonKg: number,
) {
  try {
    const gid = orderId.startsWith("gid://")
      ? orderId
      : `gid://shopify/Order/${orderId}`;

    await admin.graphql(
      `#graphql
      mutation addTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          id: gid,
          tags: ["carboniq-offset"],
        },
      },
    );

    console.log(
      `[Flow] offset.completed: ${gid} → ${carbonKg}kg`,
    );
  } catch (error) {
    console.error(`[Flow] triggerOffsetCompleted failed:`, error);
  }
}

/**
 * Trigger: label.changed
 * Removes the old label tag and adds the new one.
 */
export async function triggerLabelChanged(
  admin: AdminClient,
  productGid: string,
  oldLabel: string,
  newLabel: string,
) {
  try {
    const gid = productGid.startsWith("gid://")
      ? productGid
      : `gid://shopify/Product/${productGid}`;
    const oldTag = `carboniq:${oldLabel.toLowerCase()}`;
    const newTag = `carboniq:${newLabel.toLowerCase()}`;

    // Remove old tag
    await admin.graphql(
      `#graphql
      mutation removeTags($id: ID!, $tags: [String!]!) {
        tagsRemove(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          id: gid,
          tags: [oldTag],
        },
      },
    );

    // Add new tag
    await admin.graphql(
      `#graphql
      mutation addTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          id: gid,
          tags: [newTag],
        },
      },
    );

    console.log(
      `[Flow] label.changed: ${gid} → ${oldLabel} → ${newLabel}`,
    );
  } catch (error) {
    console.error(`[Flow] triggerLabelChanged failed:`, error);
  }
}

/**
 * Trigger: threshold.exceeded
 * Tags the product with "carboniq-high-impact" when score exceeds threshold.
 */
export async function triggerThresholdExceeded(
  admin: AdminClient,
  productGid: string,
  score: number,
  threshold: number,
) {
  try {
    const gid = productGid.startsWith("gid://")
      ? productGid
      : `gid://shopify/Product/${productGid}`;

    await admin.graphql(
      `#graphql
      mutation addTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          id: gid,
          tags: ["carboniq-high-impact"],
        },
      },
    );

    console.log(
      `[Flow] threshold.exceeded: ${gid} → ${score}kg (threshold: ${threshold}kg)`,
    );
  } catch (error) {
    console.error(`[Flow] triggerThresholdExceeded failed:`, error);
  }
}

/**
 * Action: auto-tag product with carbon label.
 * Kept for backward compatibility.
 */
export async function autoTagProduct(
  admin: AdminClient,
  shopifyProductId: string,
  carbonLabel: string,
) {
  const tag = `carboniq:${carbonLabel.toLowerCase()}`;
  try {
    await admin.graphql(
      `#graphql
      mutation addTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
        }
      }
    `,
      {
        variables: {
          id: shopifyProductId.startsWith("gid://")
            ? shopifyProductId
            : `gid://shopify/Product/${shopifyProductId}`,
          tags: [tag, "carboniq:scored"],
        },
      },
    );
  } catch (error) {
    console.error(
      `[Flow] Failed to tag product ${shopifyProductId}:`,
      error,
    );
  }
}
