/**
 * Custom Cloudflare Worker entry point.
 *
 * Re-exports the OpenNext fetch handler and adds a scheduled() handler
 * so that Cloudflare Cron Triggers (defined in wrangler.toml) can invoke
 * the Next.js cron API routes with the correct CRON_SECRET auth.
 *
 * Cron schedule (from wrangler.toml):
 *   - Every 30 min  →  /api/cron/reminders  (appointment reminders)
 *   - Daily at 2 AM →  /api/cron/billing    (subscription renewals)
 *
 * @see https://opennext.js.org/cloudflare/howtos/custom-worker
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .open-next/worker.js is generated at build time
import { default as handler } from "./.open-next/worker.js";

/**
 * Map cron expressions to their corresponding API routes.
 * The cron value comes from controller.cron and matches wrangler.toml.
 */
const CRON_ROUTES: Record<string, string> = {
  "*/30 * * * *": "/api/cron/reminders",
  "*/5 * * * *": "/api/cron/notifications",
  "0 2 * * *": "/api/cron/billing",
};

export default {
  fetch: handler.fetch,

  async scheduled(
    controller: ScheduledController,
    env: Record<string, string>,
    ctx: ExecutionContext,
  ) {
    const route = CRON_ROUTES[controller.cron] ?? null;

    if (!route) {
      console.error(`[Cron] Unknown cron expression: ${controller.cron}`);
      return;
    }

    console.log(`[Cron] Firing ${controller.cron} → ${route}`);

    // Build a request to the Next.js API route via the same Worker fetch handler.
    // Use Authorization: Bearer header — both cron routes expect this format.
    const url = new URL(route, "http://localhost");
    const headers: HeadersInit = {};

    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
      console.error(`[Cron] CRON_SECRET is not set — skipping ${route} to prevent unauthenticated requests`);
      return;
    }
    headers["Authorization"] = `Bearer ${cronSecret}`;

    const request = new Request(url.toString(), { headers });

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
  },
} satisfies ExportedHandler;
