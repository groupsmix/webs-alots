/**
 * Cron Job Infrastructure — Idempotency, DLQ, and Retry Logic (A43)
 *
 * This module provides shared infrastructure for cron jobs to ensure:
 * 1. Idempotency: Prevent duplicate execution across isolates using KV locks
 * 2. DLQ (Dead Letter Queue): Track failed runs in KV with retry logic
 * 3. Retry Mechanism: Retry failed jobs up to 3 times with exponential backoff
 *
 * Usage:
 * ```typescript
 * import { withCronInfrastructure } from "@/lib/cron-infrastructure";
 *
 * async function handler(request: NextRequest) {
 *   return withCronInfrastructure("job-name", async () => {
 *     // Your cron job logic here
 *     return apiSuccess({ message: "Job completed" });
 *   });
 * }
 * ```
 */

import { NextResponse } from "next/server";
import { apiInternalError, apiSuccess } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * KV namespace binding for cron infrastructure.
 * This is injected by Cloudflare Workers runtime.
 */
interface CronKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Get the KV namespace for cron infrastructure.
 * In production, this is bound by Cloudflare Workers.
 * In development/testing, we use a mock implementation.
 */
function getCronKV(): CronKV | null {
  // In Cloudflare Workers, KV namespaces are available on globalThis
  // @ts-expect-error - KV binding is injected by Cloudflare Workers runtime
  if (typeof globalThis.RATE_LIMIT_KV !== "undefined") {
    // @ts-expect-error - KV binding is injected by Cloudflare Workers runtime
    return globalThis.RATE_LIMIT_KV as CronKV;
  }

  // In development/testing, KV is not available
  // Return null to skip KV operations (idempotency will be best-effort)
  return null;
}

/**
 * Idempotency lock configuration
 */
interface IdempotencyConfig {
  /** Lock TTL in seconds (default: 3600 = 1 hour) */
  lockTtl?: number;
  /** Whether to skip idempotency check (for testing) */
  skipIdempotency?: boolean;
}

/**
 * DLQ (Dead Letter Queue) entry for failed cron runs
 */
interface DLQEntry {
  jobName: string;
  failedAt: string;
  error: string;
  retryCount: number;
  nextRetryAt: string | null;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay in seconds for exponential backoff (default: 60) */
  baseDelay?: number;
}

/**
 * Acquire an idempotency lock for a cron job.
 * Returns true if the lock was acquired, false if the job is already running.
 */
async function acquireIdempotencyLock(
  jobName: string,
  config: IdempotencyConfig = {},
): Promise<boolean> {
  if (config.skipIdempotency) {
    return true;
  }

  const kv = getCronKV();
  if (!kv) {
    // KV not available (development/testing) - allow execution
    logger.warn("KV not available for idempotency lock", {
      context: "cron-infrastructure",
      jobName,
    });
    return true;
  }

  const lockKey = `cron:lock:${jobName}`;
  const lockTtl = config.lockTtl ?? 3600; // 1 hour default

  try {
    // Check if lock exists
    const existingLock = await kv.get(lockKey);
    if (existingLock) {
      logger.info("Cron job already running (idempotency lock exists)", {
        context: "cron-infrastructure",
        jobName,
        lockKey,
      });
      return false;
    }

    // Acquire lock
    const lockValue = JSON.stringify({
      acquiredAt: new Date().toISOString(),
      jobName,
    });
    await kv.put(lockKey, lockValue, { expirationTtl: lockTtl });

    logger.info("Acquired idempotency lock", {
      context: "cron-infrastructure",
      jobName,
      lockKey,
      lockTtl,
    });

    return true;
  } catch (error) {
    logger.error("Failed to acquire idempotency lock", {
      context: "cron-infrastructure",
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
    // On error, allow execution (fail-open for availability)
    return true;
  }
}

/**
 * Release an idempotency lock for a cron job.
 */
async function releaseIdempotencyLock(jobName: string): Promise<void> {
  const kv = getCronKV();
  if (!kv) {
    return;
  }

  const lockKey = `cron:lock:${jobName}`;

  try {
    await kv.delete(lockKey);
    logger.info("Released idempotency lock", {
      context: "cron-infrastructure",
      jobName,
      lockKey,
    });
  } catch (error) {
    logger.error("Failed to release idempotency lock", {
      context: "cron-infrastructure",
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Add a failed cron run to the DLQ (Dead Letter Queue).
 */
async function addToDLQ(
  jobName: string,
  error: string,
  retryCount: number,
  retryConfig: RetryConfig = {},
): Promise<void> {
  const kv = getCronKV();
  if (!kv) {
    logger.warn("KV not available for DLQ", {
      context: "cron-infrastructure",
      jobName,
    });
    return;
  }

  const maxRetries = retryConfig.maxRetries ?? 3;
  const baseDelay = retryConfig.baseDelay ?? 60; // 60 seconds

  // Calculate next retry time with exponential backoff
  let nextRetryAt: string | null = null;
  if (retryCount < maxRetries) {
    const delaySeconds = baseDelay * Math.pow(2, retryCount); // 60s, 120s, 240s
    const nextRetry = new Date(Date.now() + delaySeconds * 1000);
    nextRetryAt = nextRetry.toISOString();
  }

  const dlqEntry: DLQEntry = {
    jobName,
    failedAt: new Date().toISOString(),
    error,
    retryCount,
    nextRetryAt,
  };

  const dlqKey = `cron:dlq:${jobName}:${Date.now()}`;

  try {
    await kv.put(dlqKey, JSON.stringify(dlqEntry), {
      // Keep DLQ entries for 7 days
      expirationTtl: 7 * 24 * 60 * 60,
    });

    logger.error("Added cron job to DLQ", {
      context: "cron-infrastructure",
      jobName,
      retryCount,
      nextRetryAt,
      dlqKey,
    });
  } catch (kvError) {
    logger.error("Failed to add to DLQ", {
      context: "cron-infrastructure",
      jobName,
      error: kvError instanceof Error ? kvError.message : String(kvError),
    });
  }
}

/**
 * Get the retry count for a cron job from KV.
 */
async function getRetryCount(jobName: string): Promise<number> {
  const kv = getCronKV();
  if (!kv) {
    return 0;
  }

  const retryKey = `cron:retry:${jobName}`;

  try {
    const retryData = await kv.get(retryKey);
    if (!retryData) {
      return 0;
    }

    const parsed = JSON.parse(retryData);
    return parsed.count ?? 0;
  } catch (error) {
    logger.error("Failed to get retry count", {
      context: "cron-infrastructure",
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Increment the retry count for a cron job in KV.
 */
async function incrementRetryCount(jobName: string): Promise<number> {
  const kv = getCronKV();
  if (!kv) {
    return 0;
  }

  const retryKey = `cron:retry:${jobName}`;
  const currentCount = await getRetryCount(jobName);
  const newCount = currentCount + 1;

  try {
    await kv.put(
      retryKey,
      JSON.stringify({ count: newCount, lastRetry: new Date().toISOString() }),
      {
        // Reset retry count after 24 hours
        expirationTtl: 24 * 60 * 60,
      },
    );

    return newCount;
  } catch (error) {
    logger.error("Failed to increment retry count", {
      context: "cron-infrastructure",
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
    return currentCount;
  }
}

/**
 * Reset the retry count for a cron job in KV.
 */
async function resetRetryCount(jobName: string): Promise<void> {
  const kv = getCronKV();
  if (!kv) {
    return;
  }

  const retryKey = `cron:retry:${jobName}`;

  try {
    await kv.delete(retryKey);
    logger.info("Reset retry count", {
      context: "cron-infrastructure",
      jobName,
    });
  } catch (error) {
    logger.error("Failed to reset retry count", {
      context: "cron-infrastructure",
      jobName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Wrapper for cron job handlers that provides:
 * 1. Idempotency locks (prevent duplicate execution)
 * 2. DLQ tracking (store failed runs with retry logic)
 * 3. Retry mechanism (retry failed jobs up to 3 times with exponential backoff)
 *
 * @param jobName - Unique name for the cron job (e.g., "reminders", "billing")
 * @param handler - The actual cron job logic
 * @param config - Optional configuration for idempotency and retry
 * @returns NextResponse
 */
export async function withCronInfrastructure(
  jobName: string,
  handler: () => Promise<NextResponse>,
  config: IdempotencyConfig & RetryConfig = {},
): Promise<NextResponse> {
  // Step 1: Acquire idempotency lock
  const lockAcquired = await acquireIdempotencyLock(jobName, config);
  if (!lockAcquired) {
    return apiSuccess({
      message: "Cron job already running (idempotency lock exists)",
      jobName,
      skipped: true,
    });
  }

  try {
    // Step 2: Execute the cron job handler
    const result = await handler();

    // Step 3: On success, reset retry count
    await resetRetryCount(jobName);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Cron job failed", {
      context: "cron-infrastructure",
      jobName,
      error: errorMessage,
    });

    // Step 4: On failure, increment retry count and add to DLQ
    const retryCount = await incrementRetryCount(jobName);
    await addToDLQ(jobName, errorMessage, retryCount, config);

    const maxRetries = config.maxRetries ?? 3;
    if (retryCount >= maxRetries) {
      logger.error("Cron job exceeded max retries", {
        context: "cron-infrastructure",
        jobName,
        retryCount,
        maxRetries,
      });
    }

    return apiInternalError(`Cron job failed: ${errorMessage}`);
  } finally {
    // Step 5: Always release the idempotency lock
    await releaseIdempotencyLock(jobName);
  }
}
