/**
 * Minimal Cloudflare Worker type declarations for worker-cron-handler.ts.
 *
 * These mirror the subset of @cloudflare/workers-types used by the cron handler.
 * If the project later installs @cloudflare/workers-types, this file can be removed.
 */

interface ScheduledController {
  readonly scheduledTime: number;
  readonly cron: string;
  noRetry(): void;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ExportedHandler<Env = Record<string, string>> {
  fetch?: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
  scheduled?: (controller: ScheduledController, env: Env, ctx: ExecutionContext) => void | Promise<void>;
}
