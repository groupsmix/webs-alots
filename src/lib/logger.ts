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

import { containsPotentialPHI, sanitizeErrorMessage } from "@/lib/phi-compliance";

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
  /** Correlation ID for grouping related events (e.g. payment gateway session id) */
  correlationId?: string;
  /**
   * Sentry alert category. When set, the error is tagged with `alert` so Sentry
   * alert rules can route business-critical failures (payments, WhatsApp) to the
   * on-call channel without mixing them with general application errors.
   */
  alert?: string;
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
      message: containsPotentialPHI(err.message) ? sanitizeErrorMessage(err.message) : err.message,
      stack: err.stack,
    };
  }
  const raw = String(err);
  return { raw: containsPotentialPHI(raw) ? sanitizeErrorMessage(raw) : raw };
}

// F-A93-07: PHI field names that must be auto-redacted from log metadata.
// Developers may accidentally pass these in `meta.extra`; the logger
// strips them before serialization so PHI never reaches log sinks.
const PHI_FIELD_PATTERNS = new Set([
  "email",
  "phone",
  "name",
  "patient_name",
  "patient_email",
  "patient_phone",
  "cin",
  "date_of_birth",
  "dob",
  "address",
  "ssn",
  "insurance_number",
  "medical_record",
  "prescription",
  "diagnosis",
]);

/** Recursively redact known PHI fields from a metadata object. */
function redactPhi(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PHI_FIELD_PATTERNS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && containsPotentialPHI(value)) {
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

// ── A93-2: Sampling for high-volume log messages ──
// Prevents log-flood costs during traffic spikes. Only `warn` and `info`
// messages are eligible for sampling — `error` is never dropped.
const _sampleCounters = new Map<string, { count: number; lastReset: number }>();
const SAMPLE_WINDOW_MS = 60_000;
const SAMPLE_THRESHOLD = 50;
const SAMPLE_RATE = 10; // after threshold, emit 1 in N

function shouldSample(level: LogLevel, message: string): boolean {
  if (level === "error" || level === "debug") return true;

  const key = `${level}:${message}`;
  const now = Date.now();
  let entry = _sampleCounters.get(key);

  if (!entry || now - entry.lastReset > SAMPLE_WINDOW_MS) {
    entry = { count: 0, lastReset: now };
    _sampleCounters.set(key, entry);
  }

  entry.count++;

  if (entry.count <= SAMPLE_THRESHOLD) return true;
  return entry.count % SAMPLE_RATE === 0;
}

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  // A93-2: Drop sampled-out messages early
  if (!shouldSample(level, message)) return;

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

  // Route to the console method that matches the log level.
  // In Cloudflare Workers / Node these are all captured for `wrangler tail`
  // and stderr piping; in the browser this keeps info/warn out of the red
  // error channel (e.g. the "Service worker registered" info message was
  // previously surfaced as a console error, polluting the dev console).
  // NOTE: We intentionally use console here (unlike application code)
  // because this IS the logging infrastructure.
  const serialized = JSON.stringify(payload);
  switch (level) {
    case "error":
      console.error(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    case "debug":
      console.debug(serialized);
      break;
    default:
      console.info(serialized);
  }

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
  withScope?: (callback: (scope: Scope) => void) => void;
  addBreadcrumb?: (crumb: Record<string, unknown>) => void;
};

type Scope = {
  setTag: (k: string, v: string) => void;
  setExtra: (k: string, v: unknown) => void;
  setLevel: (level: string) => void;
};

let _sentryPromise: Promise<SentryModule> | null = null;
function getSentry(): Promise<SentryModule> {
  if (!_sentryPromise) {
    _sentryPromise = import("@sentry/nextjs").catch(
      () => ({}) as SentryModule,
    ) as unknown as Promise<SentryModule>;
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
      if (meta?.alert) {
        scope.setTag("alert", meta.alert);
        // Treat alert-tagged business events as warnings so they are routed by
        // the `alert` tag without polluting the error issue stream.
        scope.setLevel("warning");
      }
      const {
        context: _ctx,
        clinicId: _cid,
        traceId: _tid,
        alert: _alert,
        error: _err,
        ...extra
      } = meta ?? {};
      for (const [k, v] of Object.entries(extra)) {
        scope.setExtra(k, v);
      }
      Sentry.captureException?.(error);
    });
  } catch {
    // Silently ignore — Sentry unavailable should never break logging
  }
}

async function captureSentryBreadcrumb(
  level: string,
  message: string,
  meta?: LogMeta,
): Promise<void> {
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
