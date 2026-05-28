/**
 * Type declaration for the OpenNext Worker entry point.
 *
 * The actual .open-next/worker.js is generated at build time by
 * @opennextjs/cloudflare. This .d.ts shim provides type safety
 * for imports in worker-cron-handler.ts without requiring a build.
 *
 * FR-06: Replaces the @ts-expect-error + knip ignoreUnresolved workaround.
 */
declare const handler: {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response>;
};
export default handler;
