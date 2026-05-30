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

/**
 * Cloudflare Queue message type.
 * Mirrors the shape from @cloudflare/workers-types without requiring the full package.
 */
interface Message<Body = unknown> {
  readonly id: string;
  readonly timestamp: Date;
  readonly body: Body;
  ack(): void;
  retry(): void;
}

interface MessageBatch<Body = unknown> {
  readonly queue: string;
  readonly messages: Message<Body>[];
  ackAll(): void;
  retryAll(): void;
}

interface Queue<Body = unknown> {
  send(body: Body): Promise<void>;
  sendBatch(messages: { body: Body }[]): Promise<void>;
}

interface ExportedHandler<Env = Record<string, string>> {
  fetch?: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
  scheduled?: (
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) => void | Promise<void>;
  /** CF Queues consumer handler — invoked when a batch is ready to process. */
  queue?: (batch: MessageBatch, env: Env, ctx: ExecutionContext) => void | Promise<void>;
}
