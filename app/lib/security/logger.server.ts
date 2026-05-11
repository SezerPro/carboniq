/**
 * Structured logging for Carboniq
 * In production, replace console with a service like LogDNA, Datadog, or Sentry
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  source: string;
}

function log(level: LogLevel, source: string, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
    source: `carboniq:${source}`,
  };

  const formatted = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`;

  switch (level) {
    case "error":
      console.error(formatted, context ? JSON.stringify(context) : "");
      break;
    case "warn":
      console.warn(formatted, context ? JSON.stringify(context) : "");
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") {
        console.debug(formatted, context ? JSON.stringify(context) : "");
      }
      break;
    default:
      console.log(formatted, context ? JSON.stringify(context) : "");
  }
}

export const logger = {
  info: (source: string, message: string, ctx?: Record<string, unknown>) => log("info", source, message, ctx),
  warn: (source: string, message: string, ctx?: Record<string, unknown>) => log("warn", source, message, ctx),
  error: (source: string, message: string, ctx?: Record<string, unknown>) => log("error", source, message, ctx),
  debug: (source: string, message: string, ctx?: Record<string, unknown>) => log("debug", source, message, ctx),

  // Specific loggers
  api: (method: string, path: string, status: number, shopDomain?: string) =>
    log("info", "api", `${method} ${path} → ${status}`, { shopDomain }),

  webhook: (topic: string, shop: string, message?: string) =>
    log("info", "webhook", `${topic} for ${shop}${message ? `: ${message}` : ""}`),

  billing: (action: string, shop: string, plan?: string) =>
    log("info", "billing", `${action} for ${shop}`, { plan }),

  security: (event: string, details?: Record<string, unknown>) =>
    log("warn", "security", event, details),

  /** Audit log for protected customer data access (GDPR/Shopify compliance) */
  dataAccess: (action: string, shopId: string, dataType: "email" | "name" | "order" | "certificate" | "offset", resourceId?: string) =>
    log("info", "audit:data-access", `${action} | type=${dataType}${resourceId ? ` | resource=${resourceId}` : ""}`, { shopId, dataType, resourceId }),
};
