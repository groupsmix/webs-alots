/**
 * Custom Cloudflare Worker entry point.
 *
 * Re-exports the OpenNext fetch handler and adds a scheduled() handler
 * so that Cloudflare Cron Triggers (defined in wrangler.toml) can invoke
 * the Next.js cron API routes with the correct CRON_SECRET auth.
 *
 * Cron schedule (must match wrangler.toml [triggers].crons exactly):
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
    const envelope =
      `{"event_id":"${eventId}","dsn":"${dsn}"}\n` +
      `{"type":"event"}\n` +
      JSON.stringify({
        event_id: eventId,
        timestamp: Date.now() / 1000,
        platform: "javascript",
        level: "error",
        logger: "worker-cron-handler",
        message: { formatted: message },
        tags: { component: "cron-handler", ...extra },
        environment: env.NODE_ENV || "production",
      });

    const headers = new Headers();
    headers.set("Content-Type", "application/x-sentry-envelope");
    await fetch(`https://${sentryHost}/api/${projectId}/envelope/?sentry_key=${publicKey}`, {
      method: "POST",
      body: envelope,
      headers,
    });
  } catch {
    // Sentry reporting is best-effort; error already logged to console
  }
}

export default {
  fetch: handler.fetch,

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
              console.error(`[Cron] ${route} responded ${res.status}: ${truncated}`);
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
