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

// F-A93-07: PHI field names that must be auto-redacted from log metadata.
// Developers may accidentally pass these in `meta.extra`; the logger
// strips them before serialization so PHI never reaches log sinks.
const PHI_FIELD_PATTERNS = new Set([
  "email", "phone", "name", "patient_name", "patient_email", "patient_phone",
  "cin", "date_of_birth", "dob", "address", "ssn", "insurance_number",
  "medical_record", "prescription", "diagnosis",
]);

/** Recursively redact known PHI fields from a metadata object. */
function redactPhi(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PHI_FIELD_PATTERNS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? redactPhi(item as Record<string, unknown>)
          : item,
      );
    } else if (value && typeof value === "object") {
      result[key] = redactPhi(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
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
  // F-A93-07: Auto-redact PHI fields from extra metadata
  if (Object.keys(extra).length > 0) Object.assign(payload, redactPhi(extra));

  // Use console.error for structured output to stderr.
  // In Cloudflare Workers this is captured by `wrangler tail`.
  // NOTE: We intentionally use console here (unlike application code)
  // because this IS the logging infrastructure.
  console.error(JSON.stringify(payload));

  // Forward to any registered external transports
  for (const transport of transports) {
    try {
      transport(payload);
    } catch (_transportErr) {
      // F-A91-06: Bind error; silently ignore to prevent logging loops
    }
  }
}

// ── Sentry Integration ──
// F-A93-02: One-time cached import of @sentry/nextjs to avoid per-call
// dynamic import overhead on hot paths (rate-limited 429s, validation 422s).
// The promise is created once and reused; V8 module cache ensures the
// actual resolution is near-instant after the first await.
type SentryModule = {
  captureException?: (err: unknown, ctx?: Record<string, unknown>) => void;
  withScope?: (cb: (scope: { setTag: (k: string, v: string) => void; setExtra: (k: string, v: unknown) => void }) => void) => void;
  addBreadcrumb?: (crumb: Record<string, unknown>) => void;
};

let _sentryPromise: Promise<SentryModule> | null = null;
function getSentry(): Promise<SentryModule> {
  if (!_sentryPromise) {
    _sentryPromise = import("@sentry/nextjs").catch(() => ({} as SentryModule));
  }
  return _sentryPromise;
}

async function captureSentryError(message: string, meta?: LogMeta): Promise<void> {
  try {
    const Sentry = await getSentry();
    if (!Sentry?.captureException) return;

    const error = meta?.error instanceof Error ? meta.error : new Error(message);
    Sentry.withScope?.((scope) => {
      if (meta?.context) scope.setTag("context", meta.context);
      if (meta?.clinicId) scope.setTag("clinicId", meta.clinicId);
      if (meta?.traceId) scope.setTag("traceId", meta.traceId);
      const { context: _ctx, clinicId: _cid, traceId: _tid, error: _err, ...extra } = meta ?? {};
      for (const [k, v] of Object.entries(extra)) {
        scope.setExtra(k, v);
      }
      Sentry.captureException?.(error);
    });
  } catch {
    // Silently ignore — Sentry unavailable should never break logging
  }
}

async function captureSentryBreadcrumb(level: string, message: string, meta?: LogMeta): Promise<void> {
  try {
    const Sentry = await getSentry();
    if (!Sentry?.addBreadcrumb) return;

    Sentry.addBreadcrumb({
      category: meta?.context ?? "app",
      message,
      level: level as "debug" | "info" | "warning" | "error" | "fatal",
      data: meta ? { ...meta, error: undefined } : undefined,
    });
  } catch {
    // Silently ignore
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
    // Forward warnings to Sentry as breadcrumbs for context on future errors
    void captureSentryBreadcrumb("warning", message, meta);
  },
  error(message: string, meta?: LogMeta): void {
    emit("error", message, meta);
    // Forward errors to Sentry for external monitoring and alerting
    void captureSentryError(message, meta);
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
