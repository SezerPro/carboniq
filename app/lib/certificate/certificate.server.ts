import crypto from "crypto";
import prisma from "../../db.server";

/**
 * Generate a random 8-character alphanumeric code using crypto.randomBytes.
 */
export function generateUniqueCode(): string {
  const bytes = crypto.randomBytes(6);
  // Convert to base36 (0-9, a-z) and take the first 8 characters, uppercased
  const raw = bytes.toString("hex");
  const code = parseInt(raw, 16).toString(36).toUpperCase().slice(0, 8);
  // Pad if shorter than 8
  return code.padEnd(8, "0");
}

/**
 * Generate a certificate for a carbon offset.
 * Links to the offset, calculates treesPlanted and oceanKg if the shop has them enabled.
 */
export async function generateCertificate(offsetId: string) {
  const offset = await prisma.carbonOffset.findUniqueOrThrow({
    where: { id: offsetId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          enableTrees: true,
          enableOcean: true,
          treeCostEur: true,
          oceanCostEur: true,
        },
      },
    },
  });

  // Ensure uniqueness of the code
  let uniqueCode = generateUniqueCode();
  let existing = await prisma.certificate.findUnique({
    where: { uniqueCode },
  });
  while (existing) {
    uniqueCode = generateUniqueCode();
    existing = await prisma.certificate.findUnique({
      where: { uniqueCode },
    });
  }

  // Calculate multi-impact values based on shop settings
  const treesPlanted = offset.shop.enableTrees
    ? Math.round((offset.carbonKg / 20) * 100) / 100 // ~1 tree per 20kg CO2
    : 0;

  const oceanKg = offset.shop.enableOcean
    ? Math.round((offset.carbonKg * 0.1) * 100) / 100 // 10% equivalent in ocean plastic
    : 0;

  const certificate = await prisma.certificate.create({
    data: {
      shopId: offset.shop.id,
      offsetId: offset.id,
      customerEmail: offset.customerEmail ?? "",
      orderName: offset.orderName ?? "",
      carbonKg: offset.carbonKg,
      treesPlanted,
      oceanKg,
      uniqueCode,
    },
    include: {
      offset: true,
      shop: {
        select: {
          id: true,
          name: true,
          shopDomain: true,
        },
      },
    },
  });

  return certificate;
}

/**
 * Find a certificate by its unique public code, including offset and shop data.
 */
export async function getCertificateByCode(code: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { uniqueCode: code },
    include: {
      offset: true,
      shop: {
        select: {
          id: true,
          name: true,
          shopDomain: true,
          badgeStyle: true,
          badgeColor: true,
        },
      },
    },
  });

  return certificate;
}

/**
 * Return the most recent certificates for a shop.
 */
export async function getCertificatesByShop(shopId: string, limit = 20) {
  const certificates = await prisma.certificate.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      offset: {
        select: {
          orderId: true,
          status: true,
          amountEur: true,
        },
      },
    },
  });

  return certificates;
}
