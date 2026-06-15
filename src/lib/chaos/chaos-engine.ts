/**
 * Lightweight chaos engineering toolkit for testing system resilience.
 *
 * IMPORTANT: Only enabled in non-production environments via CHAOS_ENABLED.
 * DO NOT enable in production without explicit approval.
 *
 * Usage:
 *   import { withChaos } from "@/lib/chaos/chaos-engine";
 *   const result = await withChaos("database_timeout", async () => {
 *     return await supabase.from("appointments").select();
 *   });
 */

import { logger } from "@/lib/logger";

export type ChaosExperiment =
  | "database_timeout" // Simulate slow DB queries
  | "database_error" // Simulate DB connection failure
  | "api_latency" // Add artificial latency to API routes
  | "api_error" // Return random 5xx errors
  | "external_api_timeout" // Simulate slow external APIs (Stripe, WhatsApp, etc.)
  | "external_api_error" // Simulate external API failures
  | "memory_pressure" // Allocate large objects to test memory limits
  | "rate_limit_trigger"; // Trigger rate limit responses

interface ChaosConfig {
  /** Probability of chaos injection (0.0 to 1.0) */
  probability: number;

  /** Delay in milliseconds (for latency experiments) */
  delayMs?: number;

  /** Error message to throw (for error experiments) */
  errorMessage?: string;

  /** HTTP status code (for API error experiments) */
  statusCode?: number;
}

const CHAOS_CONFIGS: Record<ChaosExperiment, ChaosConfig> = {
  database_timeout: {
    probability: 0.1, // 10% of DB calls
    delayMs: 5000, // 5 second delay
  },
  database_error: {
    probability: 0.05, // 5% of DB calls
    errorMessage: "CHAOS: Simulated database connection failure",
  },
  api_latency: {
    probability: 0.15, // 15% of API calls
    delayMs: 2000, // 2 second delay
  },
  api_error: {
    probability: 0.1, // 10% of API calls
    statusCode: 503,
    errorMessage: "CHAOS: Service temporarily unavailable",
  },
  external_api_timeout: {
    probability: 0.1,
    delayMs: 10000, // 10 second timeout
  },
  external_api_error: {
    probability: 0.1,
    errorMessage: "CHAOS: External API returned 500",
  },
  memory_pressure: {
    probability: 0.05,
  },
  rate_limit_trigger: {
    probability: 0.2, // 20% of requests
    statusCode: 429,
    errorMessage: "CHAOS: Rate limit exceeded",
  },
};

/**
 * Check if chaos engineering is enabled.
 * Only active in staging/development, never in production.
 */
export function isChaosEnabled(): boolean {
  const enabled = process.env.CHAOS_ENABLED === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (enabled && isProduction) {
    logger.warn("CHAOS_ENABLED is true in production — ignoring", {
      context: "chaos-engine",
    });
    return false;
  }

  return enabled;
}

/**
 * Decide whether to inject chaos based on probability.
 */
function shouldInjectChaos(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Inject artificial delay.
 */
async function injectDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an async operation with chaos injection.
 *
 * @param experiment - Type of chaos experiment
 * @param fn - The operation to execute
 * @returns Result of the operation (or throws chaos-induced error)
 */
export async function withChaos<T>(experiment: ChaosExperiment, fn: () => Promise<T>): Promise<T> {
  if (!isChaosEnabled()) {
    return fn(); // Chaos disabled, execute normally
  }

  const config = CHAOS_CONFIGS[experiment];

  if (!shouldInjectChaos(config.probability)) {
    return fn(); // No chaos this time
  }

  // Log chaos injection
  logger.info("Chaos injected", {
    context: "chaos-engine",
    experiment,
    config,
  });

  // Apply chaos based on experiment type
  if (config.delayMs) {
    await injectDelay(config.delayMs);
  }

  if (config.errorMessage) {
    const error = new Error(config.errorMessage);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).chaosExperiment = experiment;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).statusCode = config.statusCode;
    throw error;
  }

  if (experiment === "memory_pressure") {
    // Allocate a large array to stress memory
    const _memoryHog = new Array(10_000_000).fill("chaos");
    // Intentionally keep reference until function completes
  }

  return fn(); // Execute normally (after chaos effects)
}

/**
 * Middleware wrapper for chaos injection in API routes.
 *
 * Usage in route.ts:
 *   export const GET = withChaosMiddleware("api_latency", async (req) => {
 *     // ... route handler logic
 *   });
 */
export function withChaosMiddleware<T>(
  experiment: ChaosExperiment,
  handler: (req: Request) => Promise<T>,
): (req: Request) => Promise<T> {
  return async (req: Request) => {
    return withChaos(experiment, () => handler(req));
  };
}
