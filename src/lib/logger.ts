/**
 * Structured server-side logger.
 *
 * Provides structured JSON logging to stderr for production debugging.
 * In Cloudflare Workers these logs are captured by `wrangler tail`;
 * in Node.js they go to stderr and can be piped to an external service
 * (Sentry, LogTail, Datadog, etc.).
 *
 * Client-facing error responses remain generic -- this logger captures
 * the full error context server-side only.
 *
 * @example
 *   import { logger } from "@/lib/logger";
 *   try { ... } catch (err) {
 *     logger.error("Failed to process booking", { context: "booking/route", error: err });
 *     return NextResponse.json({ error: "Internal error" }, { status: 500 });
 *   }
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * External transport hook signature.
 * Implementations receive the fully-formed log payload and can forward
 * it to services like Sentry, Datadog, LogTail, etc.
 */
export type LogTransport = (payload: Record<string, unknown>) => void;

/** Registered external transports. Add via `logger.addTransport()`. */
const transports: LogTransport[] = [];

interface LogMeta {
  context?: string;
  error?: unknown;
  [key: string]: unknown;
}

function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { raw: String(err) };
}

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  const { context, error, ...extra } = meta ?? {};
  const payload: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  if (context) payload.context = context;
  if (error !== undefined) payload.error = formatError(error);
  if (Object.keys(extra).length > 0) Object.assign(payload, extra);

  // Use console.error for structured output to stderr.
  // In Cloudflare Workers this is captured by `wrangler tail`.
  // NOTE: We intentionally use console here (unlike application code)
  // because this IS the logging infrastructure.
  console.error(JSON.stringify(payload));

  // Forward to any registered external transports
  for (const transport of transports) {
    try {
      transport(payload);
    } catch {
      // Silently ignore transport errors to prevent logging loops
    }
  }
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV === "production") return;
    emit("debug", message, meta);
  },
  info(message: string, meta?: LogMeta): void {
    emit("info", message, meta);
  },
  warn(message: string, meta?: LogMeta): void {
    emit("warn", message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    emit("error", message, meta);
  },
  /**
   * Register an external log transport.
   * Transports receive every log entry and can forward to external
   * services (Sentry, Datadog, LogTail, etc.).
   *
   * @example
   *   logger.addTransport((payload) => {
   *     fetch("https://logs.example.com", {
   *       method: "POST",
   *       body: JSON.stringify(payload),
   *     }).catch(() => {});
   *   });
   */
  addTransport(transport: LogTransport): void {
    transports.push(transport);
  },
};
