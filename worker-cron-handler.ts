/**
 * Custom Cloudflare Worker entry point.
 *
 * Re-exports the OpenNext fetch handler and adds scheduled() + queue()
 * handlers so that Cloudflare Cron Triggers and Queues (defined in
 * wrangler.toml) can invoke the Next.js cron API routes and process
 * notification queue batches.
 *
 * Cron schedule (must match wrangler.toml [triggers].crons exactly):
 *   - every 5 min    →  /api/cron/uptime-monitor (health check + WhatsApp alert)
 *   - every 15 min   →  /api/cron/notifications (queued notifications)
 *                        /api/cron/audit-log-flush (MEDIUM-6 durable retry)
 *   - every 30 min   →  /api/cron/reminders     (appointment reminders)
 *   - hourly         →  /api/cron/r2-cleanup    (abandoned R2 uploads)
 *                        /api/cron/feedback      (post-appointment feedback)
 *                        /api/cron/rebooking-reminders (rebooking prompts)
 *   - daily 02:00    →  /api/cron/billing       (subscription renewals)
 *   - daily 03:00    →  /api/cron/gdpr-purge    (GDPR patient data purge)
 *   - daily 04:00    →  /api/cron/dedup-purge   (M-03/M-04 TTL purge)
 *   - daily 05:00    →  /api/cron/stripe-reconcile (BL-002 payment drift)
 *
 * @see https://opennext.js.org/cloudflare/howtos/custom-worker
 */

// @ts-expect-error — .open-next/worker.js is generated at build time
import { default as handler } from "./.open-next/worker.js";

/**
 * Map cron expressions to their corresponding API routes.
 * The cron value comes from controller.cron and matches wrangler.toml [triggers].crons.
 *
 * Some schedules fan out to multiple routes (e.g. the hourly trigger fires
 * r2-cleanup, feedback, and rebooking-reminders in parallel).
 *
 * Exported for testing (H-07 cross-check with wrangler.toml).
 */
export const CRON_ROUTES: Record<string, string[]> = {
  "*/5 * * * *": ["/api/cron/uptime-monitor"],
  "*/15 * * * *": ["/api/cron/notifications", "/api/cron/audit-log-flush"],
  "*/30 * * * *": ["/api/cron/reminders"],
  "0 * * * *": ["/api/cron/r2-cleanup", "/api/cron/feedback", "/api/cron/rebooking-reminders"],
  "0 2 * * *": ["/api/cron/billing"],
  "0 3 * * *": ["/api/cron/gdpr-purge"],
  "0 4 * * *": ["/api/cron/dedup-purge"],
  "0 5 * * *": ["/api/cron/stripe-reconcile"],
};

/**
 * H-08: Report cron errors to the Sentry tunnel endpoint so they surface
 * in the project dashboard. The route handlers already use @sentry/nextjs
 * for in-request errors, but scheduled() failures (unknown cron, missing
 * secrets, fetch-level errors) were previously console.error-only.
 *
 * We POST a minimal Sentry envelope to the DSN tunnel. If the DSN is
 * unavailable, the error is still logged to Workers Logs via console.error.
 */
async function reportCronError(
  env: Record<string, string>,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  console.error(`[Cron] ${message}`, extra);

  const dsn = env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const dsnUrl = new URL(dsn);
    const projectId = dsnUrl.pathname.replace("/", "");
    const sentryHost = dsnUrl.hostname;
    const publicKey = dsnUrl.username;

    const eventId = crypto.randomUUID().replace(/-/g, "");
    // I-02: Use JSON.stringify for every Sentry envelope line to prevent
    // JSON injection if the DSN or any extra value contains quote/newline chars.
    const envelope = [
      JSON.stringify({ event_id: eventId, dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify({
        event_id: eventId,
        timestamp: Date.now() / 1000,
        platform: "javascript",
        level: "error",
        logger: "worker-cron-handler",
        message: { formatted: message },
        tags: { component: "cron-handler", ...extra },
        environment: env.NODE_ENV || "production",
      }),
    ].join("\n");

    const headers = new Headers();
    headers.set("Content-Type", "application/x-sentry-envelope");
    // P-03: Hard timeout so a Sentry network partition can't hang the cron
    // handler for 30 s. reportCronError is called inside ctx.waitUntil()
    // so 3 s is generous without blocking the next cron tick.
    await fetch(`https://${sentryHost}/api/${projectId}/envelope/?sentry_key=${publicKey}`, {
      method: "POST",
      body: envelope,
      headers,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Sentry reporting is best-effort; error already logged to console
  }
}

export default {
  fetch: handler.fetch,

  /**
   * INF-Q1: Cloudflare Queue consumer handler.
   *
   * Wired to the notification-queue declared in wrangler.toml [[queues.consumers]].
   * When a batch arrives, delegates to the existing /api/cron/notifications route
   * via an internal fetch (same pattern as the scheduled() handler). The cron
   * route calls processNotificationQueue() which atomically claims pending rows,
   * delivers them, and marks them sent/failed — idempotent by design.
   *
   * Individual message ack/retry is intentionally not used here. The DB-level
   * processing in processNotificationQueue() is the source of truth for delivery
   * state. We ackAll() after the route responds and let the cron fallback handle
   * any edge cases.
   */
  async queue(
    batch: MessageBatch,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log(
      `[Queue] Processing batch of ${batch.messages.length} messages from ${batch.queue}`,
    );

    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
      console.error("[Queue] CRON_SECRET not set — cannot authenticate internal request");
      batch.retryAll();
      return;
    }
    // I-06: Validate CRON_SECRET format to prevent CRLF header injection.
    // The secret should be a 64-char hex string (openssl rand -hex 32 output).
    // Reject any value with whitespace or control characters.
    if (!/^[\x21-\x7E]+$/.test(cronSecret)) {
      console.error("[Queue] CRON_SECRET contains illegal characters — refusing to forward");
      batch.retryAll();
      return;
    }

    const baseUrl =
      env.CRON_SELF_BASE_URL || (env.ROOT_DOMAIN ? `https://${env.ROOT_DOMAIN}` : null);
    if (!baseUrl) {
      console.error("[Queue] No CRON_SELF_BASE_URL or ROOT_DOMAIN — cannot route internal request");
      batch.retryAll();
      return;
    }

    try {
      const url = new URL("/api/cron/notifications", baseUrl);
      const request = new Request(url.toString(), {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });

      const res = await handler.fetch(request, env, ctx);

      if (res.ok) {
        console.log(`[Queue] /api/cron/notifications responded ${res.status} — acking batch`);
        batch.ackAll();
      } else {
        const body = await res.text();
        const truncated = body.length > 200 ? body.slice(0, 200) + "…" : body;
        // T-04: Strip newlines/CRLF before logging to prevent log injection
        // via attacker-controlled response bodies with embedded log lines.
        const sanitized = truncated.replace(/[\r\n\t]/g, " ");
        console.error(`[Queue] /api/cron/notifications responded ${res.status}: ${sanitized}`);
        batch.retryAll();
      }
    } catch (err) {
      console.error("[Queue] Batch processing failed — retrying all", err);
      batch.retryAll();
    }
  },

  async scheduled(
    controller: ScheduledController,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ) {
    const routes = CRON_ROUTES[controller.cron] ?? null;

    if (!routes) {
      void reportCronError(env, `Unknown cron expression: ${controller.cron}`, {
        cron: controller.cron,
      });
      return;
    }

    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
      void reportCronError(
        env,
        `CRON_SECRET is not set — skipping ${controller.cron} to prevent unauthenticated requests`,
        { cron: controller.cron },
      );
      return;
    }
    // I-06: Validate CRON_SECRET format before injecting it into an HTTP header.
    // A secret with CRLF (\r\n) would split the Authorization header and inject
    // arbitrary headers into every internal cron request.
    if (!/^[\x21-\x7E]+$/.test(cronSecret)) {
      void reportCronError(env, "CRON_SECRET contains illegal characters — refusing all cron jobs", {
        cron: controller.cron,
      });
      return;
    }

    const cronBaseUrl =
      env.CRON_SELF_BASE_URL || (env.ROOT_DOMAIN ? `https://${env.ROOT_DOMAIN}` : null);
    if (!cronBaseUrl) {
      void reportCronError(
        env,
        `Neither CRON_SELF_BASE_URL nor ROOT_DOMAIN is set — refusing to fire ${controller.cron}`,
        { cron: controller.cron },
      );
      return;
    }

    for (const route of routes) {
      // I-01: Assert route is a known /api/cron/* path before using it as a
      // URL base. Prevents a URL-resolution attack where a route like
      // "//attacker.com/path" would override the cronBaseUrl entirely.
      if (!route.startsWith("/api/cron/")) {
        void reportCronError(env, `Route "${route}" does not start with /api/cron/ — skipping`, {
          cron: controller.cron,
          route,
        });
        continue;
      }

      console.log(`[Cron] Firing ${controller.cron} → ${route}`);

      const url = new URL(route, cronBaseUrl);
      const request = new Request(url.toString(), {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });

      ctx.waitUntil(
        handler
          .fetch(request, env, ctx)
          .then(async (res: Response) => {
            // L-08: Redact response body — may contain operational data
            // (row counts from gdpr-purge, billing details, etc.)
            if (res.ok) {
              console.log(`[Cron] ${route} responded ${res.status}`);
            } else {
              const body = await res.text();
              const truncated = body.length > 200 ? body.slice(0, 200) + "…" : body;
              // T-04: Strip newlines/CRLF to prevent log injection via response bodies.
              const sanitized = truncated.replace(/[\r\n\t]/g, " ");
              console.error(`[Cron] ${route} responded ${res.status}: ${sanitized}`);
              void reportCronError(env, `${route} responded ${res.status}`, {
                cron: controller.cron,
                route,
                status: String(res.status),
              });
            }
          })
          .catch((err: unknown) => {
            console.error(`[Cron] ${route} failed:`, err);
            void reportCronError(env, `${route} fetch failed: ${err}`, {
              cron: controller.cron,
              route,
            });
          }),
      );
    }
  },
} satisfies ExportedHandler;
