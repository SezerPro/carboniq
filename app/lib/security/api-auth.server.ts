import crypto from "crypto";
import prisma from "../../db.server";

/**
 * Carboniq API Security Module
 *
 * 1. HMAC signature verification for write APIs (offset, A/B test)
 * 2. Restricted CORS for write APIs (*.myshopify.com only)
 * 3. Encryption for sensitive data (Klaviyo keys)
 * 4. Rate limiting (in-memory, per shop)
 */

// ── CORS ────────────────────────────────────────────────

/** CORS for read-only public APIs (badge, DPP, impact stats) */
export const CORS_PUBLIC: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

/** CORS for write APIs (offset, A/B test) — restricted to Shopify domains */
export function getCorsWriteHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = origin.endsWith(".myshopify.com") || origin.endsWith(".shopify.com") || origin === "";

  return {
    "Access-Control-Allow-Origin": allowed ? origin || "*" : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Carboniq-Signature",
    "Content-Type": "application/json",
  };
}

// ── HMAC Signature ──────────────────────────────────────

const API_SECRET = process.env.SHOPIFY_API_SECRET ?? "carboniq-dev-secret";

/** Generate HMAC signature for a payload */
export function generateSignature(payload: string): string {
  return crypto.createHmac("sha256", API_SECRET).update(payload).digest("hex");
}

/** Verify HMAC signature from X-Carboniq-Signature header */
export function verifySignature(request: Request, body: string): boolean {
  const signature = request.headers.get("X-Carboniq-Signature");
  if (!signature) return false;

  const expected = generateSignature(body);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Verify that the shop exists and the request is legitimate.
 * For write APIs, checks HMAC signature.
 * For read APIs, just validates the shop domain exists.
 */
export async function verifyApiRequest(
  request: Request,
  shopDomain: string,
  options: { requireSignature?: boolean; body?: string } = {},
): Promise<{ valid: boolean; shopId?: string; error?: string }> {
  // Validate shop domain format
  if (!shopDomain || !shopDomain.includes(".myshopify.com")) {
    return { valid: false, error: "Invalid shop domain" };
  }

  // Check shop exists
  const shop = await prisma.shop.findUnique({
    where: { shopDomain },
    select: { id: true, planStatus: true },
  });

  if (!shop) {
    return { valid: false, error: "Shop not found" };
  }

  // Check plan is active
  if (shop.planStatus !== "ACTIVE" && shop.planStatus !== "TRIALING") {
    return { valid: false, error: "Plan inactive" };
  }

  // Verify HMAC signature for write operations
  if (options.requireSignature && options.body) {
    if (!verifySignature(request, options.body)) {
      return { valid: false, error: "Invalid signature" };
    }
  }

  return { valid: true, shopId: shop.id };
}

// ── Rate Limiting ───────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS = {
  read: { max: 60, windowMs: 60_000 },   // 60 req/min for reads
  write: { max: 10, windowMs: 60_000 },   // 10 req/min for writes
};

/** Check rate limit. Returns true if allowed, false if exceeded. */
export function checkRateLimit(
  key: string,
  type: "read" | "write" = "read",
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const limit = RATE_LIMITS[type];
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.max - 1, resetIn: limit.windowMs };
  }

  entry.count++;

  if (entry.count > limit.max) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  return { allowed: true, remaining: limit.max - entry.count, resetIn: entry.resetAt - now };
}

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}, 300_000);

// ── Encryption ──────────────────────────────────────────

const ENCRYPT_KEY = crypto
  .createHash("sha256")
  .update(process.env.SHOPIFY_API_SECRET ?? "carboniq-encrypt-fallback")
  .digest();

const IV_LENGTH = 16;

/** Encrypt a string (for storing API keys in DB) */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPT_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

/** Decrypt a string */
export function decrypt(encrypted: string): string {
  const [ivHex, encryptedText] = encrypted.split(":");
  if (!ivHex || !encryptedText) return encrypted; // Not encrypted, return as-is
  try {
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPT_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encrypted; // Decryption failed, return as-is (likely not encrypted)
  }
}

// ── Input Sanitization ──────────────────────────────────

/** Strip HTML tags from input */
export function sanitize(input: string | null | undefined): string | null {
  if (!input) return null;
  return input.replace(/<[^>]*>/g, "").trim();
}
