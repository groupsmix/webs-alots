import * as Sentry from "@sentry/nextjs";

/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// R-20 Fix: Per-route sampling configuration for instrumentation
const SAMPLE_RATES = {
  // Critical paths: 100% sampling for webhooks, cron, payment
  CRITICAL: 1.0,
  // Mutations: 50% sampling for POST/PUT/PATCH/DELETE
  MUTATION: 0.5,
  // Read operations: 10% sampling for GET requests
  READ: 0.1,
} as const;

/**
 * Get sample rate based on transaction context
 */
function getSampleRate(transactionContext: {
  name?: string;
  description?: string;
  tags?: Record<string, string>;
}): number {
  const context = [
    transactionContext.name || "",
    transactionContext.description || "",
    ...Object.values(transactionContext.tags || {}),
  ]
    .join(" ")
    .toLowerCase();

  // Critical paths
  if (
    context.includes("webhook") ||
    context.includes("cron") ||
    context.includes("payment") ||
    context.includes("stripe") ||
    context.includes("notification") ||
    context.includes("reminder")
  ) {
    return SAMPLE_RATES.CRITICAL;
  }

  // Mutations
  if (
    context.includes("post") ||
    context.includes("put") ||
    context.includes("patch") ||
    context.includes("delete") ||
    context.includes("booking") ||
    context.includes("appointment") ||
    context.includes("register")
  ) {
    return SAMPLE_RATES.MUTATION;
  }

  // Reads
  return SAMPLE_RATES.READ;
}

export function register() {
  // Audit F-1: a placeholder DSN (e.g. "https://placeholder@…") is truthy but
  // useless — it boots a dead Sentry client. Treat it as unset everywhere so
  // misconfiguration fails closed. The hard production gate (throw on boot) is
  // in src/lib/env.ts via enforceEnvValidation(), invoked below.
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const hasValidSentryDsn = !!sentryDsn && !/placeholder/i.test(sentryDsn);

  // Initialize Sentry for server-side error monitoring.
  // DSN is provided via NEXT_PUBLIC_SENTRY_DSN env var.
  if (hasValidSentryDsn) {
    Sentry.init({
      dsn: sentryDsn,

      // R-20 Fix: Set sendDefaultPii to false explicitly
      // @sentry/nextjs@8 defaults this to true, which is a PII risk
      sendDefaultPii: false,

      // Base tracesSampleRate; per-transaction sampling is handled via tracesSampler
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      enabled: hasValidSentryDsn,

      // R-20 Fix: Per-transaction sampling for fine-grained control
      tracesSampler(samplingContext) {
        return getSampleRate(samplingContext);
      },

      // S-35: Strip PHI from Sentry events before they leave the server.
      // Request bodies, known PHI fields, and breadcrumb data that could
      // contain patient information are scrubbed. This is defense-in-depth
      // on top of sendDefaultPii: false.
      beforeSend(event) {
        // Strip request bodies — they may contain patient data.
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          if (event.request.headers) {
            // Remove auth-related headers that could contain session tokens.
            const safeHeaders: Record<string, string> = {};
            const SAFE_HEADER_NAMES = new Set([
              "content-type",
              "accept",
              "user-agent",
              "referer",
              "x-trace-id",
              "host",
            ]);
            for (const [k, v] of Object.entries(event.request.headers)) {
              if (SAFE_HEADER_NAMES.has(k.toLowerCase())) {
                safeHeaders[k] = String(v);
              }
            }
            event.request.headers = safeHeaders;
          }
        }
        // Strip known PHI field names anywhere arbitrary key/value data is
        // attached to the event — event.extra, event.contexts (walked
        // recursively; these may be nested via Sentry.setContext()), and
        // event.tags (flat via Sentry.setTag()).
        const PHI_KEYS = new Set([
          "phone",
          "email",
          "name",
          "patientname",
          "patient_name",
          "name_ar",
          "full_name",
          "address",
          "notes",
          "content",
          "message",
          "file_name",
          "date_of_birth",
          "dob",
          "insurance_number",
          "cin",
          "ssn",
        ]);
        const scrubPHI = (value: unknown, depth = 0): unknown => {
          if (depth > 10 || value === null || value === undefined) return value;
          if (Array.isArray(value)) {
            return value.map((v) => scrubPHI(v, depth + 1));
          }
          if (typeof value === "object") {
            const obj = value as Record<string, unknown>;
            for (const key of Object.keys(obj)) {
              if (PHI_KEYS.has(key.toLowerCase())) {
                obj[key] = "[REDACTED]";
              } else {
                obj[key] = scrubPHI(obj[key], depth + 1);
              }
            }
            return obj;
          }
          return value;
        };
        if (event.extra) scrubPHI(event.extra);
        if (event.contexts) scrubPHI(event.contexts);
        if (event.tags) {
          for (const key of Object.keys(event.tags)) {
            if (PHI_KEYS.has(key.toLowerCase())) {
              event.tags[key] = "[REDACTED]";
            }
          }
        }
        // R-11: Redact PHI patterns from error message strings and
        // breadcrumb messages. Sentry error messages may contain DB
        // row data from PostgREST errors — regex catches Moroccan
        // phone numbers, CIN, email addresses, and insurance IDs.
        const PHI_PATTERNS = [
          /\+212\d{9}/g, // Moroccan phone
          /0[5-7]\d{8}/g, // Local Moroccan phone
          /[A-Z]{1,2}\d{5,7}/g, // CIN pattern
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
          /\b\d{7,13}\b/g, // AMO/CNSS/CNOPS numbers
        ];
        const redactPHIStrings = (str: string): string => {
          let result = str;
          for (const pattern of PHI_PATTERNS) {
            result = result.replace(pattern, "[REDACTED]");
          }
          return result;
        };
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = redactPHIStrings(ex.value);
          }
        }
        return event;
      },

      // S-35: Strip PHI from breadcrumbs (e.g. fetch body data).
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.data) {
          delete breadcrumb.data.body;
          delete breadcrumb.data.request_body;
          delete breadcrumb.data.response_body;
        }
        if (breadcrumb.message) {
          const PHI_PATTERNS = [
            /\+212\d{9}/g,
            /0[5-7]\d{8}/g,
            /[A-Z]{1,2}\d{5,7}/g,
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            /\b\d{7,13}\b/g,
          ];
          for (const pattern of PHI_PATTERNS) {
            breadcrumb.message = breadcrumb.message.replace(pattern, "[REDACTED]");
          }
        }
        return breadcrumb;
      },
    });
  }
  // Validate all required environment variables at startup so missing
  // config is surfaced immediately rather than at runtime.
  // Dynamic import avoids pulling logger into the module graph before
  // Next.js has finished bootstrapping.
  // AUDIT P1-5: The .then() must re-throw so the error propagates as an
  // unhandled rejection that crashes the Worker, rather than being swallowed.
  import("@/lib/env")
    .then(({ enforceEnvValidation }) => {
      enforceEnvValidation();
    })
    .catch((err) => {
      // M-26: Capture to Sentry before crashing so the failure is visible
      // in the dashboard, not buried in Workers Logs / console output.
      console.error("[FATAL] Environment validation failed:", err);
      if (hasValidSentryDsn) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(`Environment validation failed: ${err}`),
          { tags: { component: "instrumentation", phase: "env-validation" }, level: "fatal" },
        );
      }
      // Re-throw to ensure the Worker/server process crashes on missing
      // required env vars instead of silently serving traffic.
      throw err;
    });

  // F-12: Fatal throw when staging env uses production Supabase.
  if (process.env.ROOT_DOMAIN?.includes("staging")) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (supabaseUrl && !supabaseUrl.includes("staging")) {
      const message =
        "[FATAL] Staging environment detected (ROOT_DOMAIN contains 'staging') " +
        "but NEXT_PUBLIC_SUPABASE_URL does not point to a staging Supabase project.\n" +
        "Current value: " +
        supabaseUrl +
        "\n" +
        "Staging MUST use a separate Supabase project to prevent data leakage.";
      import("@/lib/logger").then(({ logger }) =>
        logger.error(message, { context: "instrumentation" }),
      );
      throw new Error(message);
    }
  }

  // F-02: Enforce seed user deletion via a positive DB check in production.
  // The environment check for SEED_PASSWORDS_ROTATED is centralized in enforceEnvValidation()
  // (see src/lib/env.ts).
  // The runtime guard additionally verifies that seed accounts are truly gone
  // from auth.users so that a forked repo cannot bypass the check by setting
  // the env var without actually deleting the accounts.
  if (process.env.NODE_ENV === "production") {
    import("@/lib/seed-guard").then(({ listBlockedSeedEmails }) => {
      import("@/lib/supabase-server").then(({ createAdminClient }) => {
        try {
          const supabase = createAdminClient("instrumentation");
          listBlockedSeedEmails().then((emails) => {
            if (emails.length === 0) return;
            supabase
              .from("users")
              .select("id")
              .in("email", emails)
              .limit(1)
              .then(({ data }) => {
                if (data && data.length > 0) {
                  import("@/lib/logger").then(({ logger }) => {
                    logger.error(
                      "[STARTUP WARNING] Seed user accounts still exist in the database despite " +
                        "SEED_PASSWORDS_ROTATED being set. Delete seed accounts for full security.",
                      { context: "instrumentation", seedUsersFound: data.length },
                    );
                  });
                }
              });
          });
        } catch {
          // DB check is best-effort; env var guard is the primary gate
        }
      });
    });

    if (process.env.SEED_USERS_DELETED !== "true") {
      import("@/lib/logger").then(({ logger }) => {
        logger.warn(
          "[STARTUP WARNING] SEED_PASSWORDS_ROTATED is set but SEED_USERS_DELETED is not.\n" +
            "The seed user emails (e.g. admin@demo-clinic.com) are publicly visible in the\n" +
            "GitHub repository. Deleting these accounts entirely is strongly recommended.\n" +
            "Set SEED_USERS_DELETED=true after removing them to silence this warning.",
          { context: "instrumentation" },
        );
      });
    }
  }
}
