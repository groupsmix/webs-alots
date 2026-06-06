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

/**
 * Minimal R2 bucket binding types — the subset of @cloudflare/workers-types
 * used by src/lib/r2.ts (put / get / head / delete / list). Mirrors the
 * runtime shape without requiring the full package.
 */
interface R2HTTPMetadata {
  contentType?: string;
  contentDisposition?: string;
}

interface R2Object {
  readonly key: string;
  readonly size: number;
  readonly httpMetadata?: R2HTTPMetadata;
}

interface R2ObjectBody extends R2Object {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

interface R2Range {
  offset?: number;
  length?: number;
}

interface R2GetOptions {
  range?: R2Range;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
}

interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null,
    options?: R2PutOptions,
  ): Promise<R2Object>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

/**
 * Cloudflare KV Namespace binding.
 * Mirrors the subset of @cloudflare/workers-types used across the codebase.
 */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Cloudflare Worker environment bindings for Oltigo.
 * Add new KV / R2 / Queue bindings here as they are provisioned.
 */
interface CloudflareEnv {
  /** In-memory-compatible distributed rate limiter — see rate-limit.ts */
  RATE_LIMIT_KV: KVNamespace;
  /** Subdomain → clinic lookup cache (5-min TTL). Used by middleware. */
  SUBDOMAIN_KV?: KVNamespace;
  /** TASK-017: Tenant lookup cache — 5-min TTL. Provision with wrangler kv namespace create TENANT_CACHE */
  TENANT_CACHE: KVNamespace;
  /** General-purpose app cache (feature flags, AI config) */
  APP_CACHE_KV?: KVNamespace;
  /** Cloudflare R2 bucket for PHI file storage */
  PHI_BUCKET?: R2Bucket;
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
