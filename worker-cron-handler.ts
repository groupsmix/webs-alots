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
 *   - daily 05:00    →  /api/cron/stripe-reconcile (BL-002 payment drift)
 *
 * @see https://opennext.js.org/cloudflare/howtos/custom-worker
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .open-next/worker.js is generated at build time
import { default as handler } from "./.open-next/worker.js";

/**
 * Map cron expressions to their corresponding API routes.
 * The cron value comes from controller.cron and matches wrangler.toml [triggers].crons.
 *
 * Some schedules fan out to multiple routes (e.g. the hourly trigger fires
 * r2-cleanup, feedback, and rebooking-reminders in parallel).
 */
const CRON_ROUTES: Record<string, string[]> = {
  "*/15 * * * *": ["/api/cron/notifications", "/api/cron/audit-log-flush"],
  "*/30 * * * *": ["/api/cron/reminders"],
  "0 * * * *": ["/api/cron/r2-cleanup", "/api/cron/feedback", "/api/cron/rebooking-reminders"],
  "0 2 * * *": ["/api/cron/billing"],
  "0 3 * * *": ["/api/cron/gdpr-purge"],
  "0 5 * * *": ["/api/cron/stripe-reconcile"],
};

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ) {
    const routes = CRON_ROUTES[controller.cron] ?? null;

    if (!routes) {
      console.error(`[Cron] Unknown cron expression: ${controller.cron}`);
      return;
    }

    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
      console.error(
        `[Cron] CRON_SECRET is not set — skipping ${controller.cron} to prevent unauthenticated requests`,
      );
      return;
    }

    // B-03 / A43.5: Build requests to the Next.js API routes via the same
    // Worker fetch handler.  CRON_SELF_BASE_URL (or ROOT_DOMAIN) must be set
    // per-environment so staging crons never accidentally hit production.
    const cronBaseUrl =
      env.CRON_SELF_BASE_URL || (env.ROOT_DOMAIN ? `https://${env.ROOT_DOMAIN}` : null);
    if (!cronBaseUrl) {
      console.error(
        `[Cron] Neither CRON_SELF_BASE_URL nor ROOT_DOMAIN is set — refusing to fire ${controller.cron} to avoid cross-environment request`,
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
            const body = await res.text();
            console.log(`[Cron] ${route} responded ${res.status}: ${body}`);
          })
          .catch((err: unknown) => {
            console.error(`[Cron] ${route} failed:`, err);
          }),
      );
    }
  },
} satisfies ExportedHandler;
