import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

/**
 * A62-E2: Sentry Error Flush on Shutdown
 *
 * Problem:
 *   When a Node/Edge Runtime process exits unexpectedly (crash, timeout, kill),
 *   Sentry error events queued in memory are lost. Audit trail gaps result,
 *   making post-mortem debugging impossible.
 *
 * Solution:
 *   - Call flushSentryOnExit() in exception handlers and finally blocks
 *   - Waits up to 5 seconds for pending events to flush to Sentry
 *   - Logs flush success/failure so operators know the audit trail is complete
 */

/**
 * Flush pending Sentry events and close the client.
 * Safe to call multiple times (idempotent).
 *
 * @param timeoutMs Maximum wait time for flush (default: 5000ms)
 * @returns true if flush succeeded, false if timeout or error
 */
export async function flushSentryOnExit(timeoutMs: number = 5000): Promise<boolean> {
  try {
    const client = Sentry.getClient();
    if (!client) {
      return true;
    }

    const flushed = await client.close(timeoutMs);
    if (flushed) {
      logger.info("sentry-flush: successfully flushed pending events", {
        context: "sentry-flush",
      });
    } else {
      logger.warn("sentry-flush: timeout waiting for pending events", {
        context: "sentry-flush",
        timeoutMs,
      });
    }
    return flushed;
  } catch (err) {
    logger.error("sentry-flush: error during flush", {
      context: "sentry-flush",
      error: err,
    });
    return false;
  }
}

/**
 * Decorator for route handlers that need guaranteed Sentry flush on error.
 * Wraps the handler in a try-catch-finally that flushes Sentry on exception.
 *
 * @example
 * ```ts
 * import { withSentryFlush } from "@/lib/sentry-flush";
 *
 * const handler = async (req) => {
 *   // ... route logic
 *   return response;
 * };
 *
 * export const POST = withSentryFlush(handler);
 * ```
 */
export function withSentryFlush<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
): T {
  return (async (...args: unknown[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      Sentry.captureException(error);
      await flushSentryOnExit(5000);
      throw error;
    }
  }) as T;
}
