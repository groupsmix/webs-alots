/**
 * Structured server-side logger with trace ID support.
 *
 * Provides structured JSON logging to stderr for production debugging.
 * In Cloudflare Workers these logs are captured by `wrangler tail`;
 * in Node.js they go to stderr and can be piped to an external service
 * (Sentry, LogTail, Datadog, etc.).
 *
 * Trace IDs are generated per-request in middleware and propagated via
 * the `x-trace-id` header. All log entries within a request share the
 * same trace ID for easy correlation in multi-tenant debugging.
 *
 * Client-facing error responses remain generic -- this logger captures
 * the full error context server-side only.
 *
 * @example
 *   import { logger } from "@/lib/logger";
 *   try { ... } catch (err) {
 *     logger.error("Failed to process booking", { context: "booking/route", error: err, traceId: "abc-123" });
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
  /** Tenant clinic_id for multi-tenant audit trail */
  clinicId?: string | null;
  /** Request trace ID for correlation across log entries */
  traceId?: string;
  error?: unknown;
  [key: string]: unknown;
}

/**
 * Generate a unique trace ID for request correlation.
 * Uses crypto.randomUUID() for globally unique, non-guessable IDs.
 */
export function generateTraceId(): string {
  return crypto.randomUUID();
}

/** Header name used to propagate trace IDs across the request pipeline. */
export const TRACE_ID_HEADER = "x-trace-id";

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
  const { context, clinicId, traceId, error, ...extra } = meta ?? {};
  const payload: Record<string, unknown> = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  if (traceId) payload.traceId = traceId;
  if (context) payload.context = context;
  if (clinicId !== undefined) payload.clinicId = clinicId;
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
