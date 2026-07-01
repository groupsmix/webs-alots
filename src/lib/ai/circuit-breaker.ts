/**
 * Shared AI circuit breaker.
 *
 * Protects user-facing AI routes from repeatedly calling unstable providers
 * during outage windows. State is stored in FEATURE_FLAGS_KV when available,
 * with an in-memory fallback for dev/test.
 */

import { getKVBinding } from "@/lib/features";
import { logger } from "@/lib/logger";

const CIRCUIT_BREAKER_KEY = "ai.circuit_breaker.v1";
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_FAILURE_WINDOW_MS = 60_000;
const DEFAULT_OPEN_MS = 5 * 60_000;

type AICircuitState = "closed" | "open" | "half_open";

interface StoredCircuitBreakerState {
  consecutiveFailures: number;
  firstFailureAt: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  openUntil: number | null;
  lastOpenedAt: number | null;
}

export interface AICircuitBreakerSnapshot {
  state: AICircuitState;
  backend: "kv" | "memory";
  consecutiveFailures: number;
  failureThreshold: number;
  failureWindowMs: number;
  cooldownMs: number;
  openUntil: string | null;
  lastOpenedAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
}

export class AICircuitBreakerOpenError extends Error {
  readonly snapshot: AICircuitBreakerSnapshot;

  constructor(snapshot: AICircuitBreakerSnapshot) {
    super("AI circuit breaker is open");
    this.name = "AICircuitBreakerOpenError";
    this.snapshot = snapshot;
  }
}

let memoryState: StoredCircuitBreakerState = emptyState();

function emptyState(): StoredCircuitBreakerState {
  return {
    consecutiveFailures: 0,
    firstFailureAt: null,
    lastFailureAt: null,
    lastFailureReason: null,
    openUntil: null,
    lastOpenedAt: null,
  };
}

function parseMs(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFailureThreshold(): number {
  return Math.max(
    1,
    Math.floor(
      parseMs(process.env.AI_CIRCUIT_BREAKER_FAILURE_THRESHOLD, DEFAULT_FAILURE_THRESHOLD),
    ),
  );
}

function getFailureWindowMs(): number {
  return parseMs(process.env.AI_CIRCUIT_BREAKER_FAILURE_WINDOW_MS, DEFAULT_FAILURE_WINDOW_MS);
}

function getCooldownMs(): number {
  return parseMs(process.env.AI_CIRCUIT_BREAKER_COOLDOWN_MS, DEFAULT_OPEN_MS);
}

function toIso(value: number | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function deriveState(raw: StoredCircuitBreakerState, now: number): AICircuitState {
  if (raw.openUntil && raw.openUntil > now) return "open";
  if (raw.openUntil && raw.openUntil <= now && raw.consecutiveFailures > 0) return "half_open";
  return "closed";
}

async function readRawState(): Promise<{
  backend: "kv" | "memory";
  raw: StoredCircuitBreakerState;
}> {
  try {
    const kv = await getKVBinding("FEATURE_FLAGS_KV");
    if (!kv) {
      return { backend: "memory", raw: memoryState };
    }

    const value = await kv.get(CIRCUIT_BREAKER_KEY, { type: "text" });
    if (!value || typeof value !== "string") {
      return { backend: "kv", raw: emptyState() };
    }

    const parsed = JSON.parse(value) as Partial<StoredCircuitBreakerState>;
    return {
      backend: "kv",
      raw: {
        consecutiveFailures: Number(parsed.consecutiveFailures ?? 0),
        firstFailureAt: parsed.firstFailureAt ?? null,
        lastFailureAt: parsed.lastFailureAt ?? null,
        lastFailureReason: parsed.lastFailureReason ?? null,
        openUntil: parsed.openUntil ?? null,
        lastOpenedAt: parsed.lastOpenedAt ?? null,
      },
    };
  } catch (error) {
    logger.warn("Failed to read AI circuit breaker state; using memory fallback", {
      context: "ai-circuit-breaker",
      error: error instanceof Error ? error.message : String(error),
    });
    return { backend: "memory", raw: memoryState };
  }
}

async function writeRawState(
  backend: "kv" | "memory",
  raw: StoredCircuitBreakerState,
): Promise<void> {
  if (backend === "memory") {
    memoryState = raw;
    return;
  }

  try {
    const kv = await getKVBinding("FEATURE_FLAGS_KV");
    if (!kv) {
      memoryState = raw;
      return;
    }

    await kv.put(CIRCUIT_BREAKER_KEY, JSON.stringify(raw));
  } catch (error) {
    logger.warn("Failed to persist AI circuit breaker state; falling back to memory", {
      context: "ai-circuit-breaker",
      error: error instanceof Error ? error.message : String(error),
    });
    memoryState = raw;
  }
}

function buildSnapshot(
  backend: "kv" | "memory",
  raw: StoredCircuitBreakerState,
  now: number = Date.now(),
): AICircuitBreakerSnapshot {
  return {
    state: deriveState(raw, now),
    backend,
    consecutiveFailures: raw.consecutiveFailures,
    failureThreshold: getFailureThreshold(),
    failureWindowMs: getFailureWindowMs(),
    cooldownMs: getCooldownMs(),
    openUntil: toIso(raw.openUntil),
    lastOpenedAt: toIso(raw.lastOpenedAt),
    lastFailureAt: toIso(raw.lastFailureAt),
    lastFailureReason: raw.lastFailureReason,
  };
}

export async function getAICircuitBreakerSnapshot(): Promise<AICircuitBreakerSnapshot> {
  const { backend, raw } = await readRawState();
  return buildSnapshot(backend, raw);
}

export async function assertAICircuitBreakerAllowsRequests(): Promise<
  | { ok: true; snapshot: AICircuitBreakerSnapshot }
  | { ok: false; snapshot: AICircuitBreakerSnapshot; reason: string; statusCode: number }
> {
  const snapshot = await getAICircuitBreakerSnapshot();
  if (snapshot.state === "open") {
    return {
      ok: false,
      snapshot,
      reason: "AI service temporarily unavailable (circuit breaker open)",
      statusCode: 503,
    };
  }

  return { ok: true, snapshot };
}

export function shouldTripAICircuitBreaker(statusCode?: number): boolean {
  if (statusCode === undefined) return true;
  return statusCode === 429 || statusCode >= 500;
}

export async function recordAICircuitBreakerSuccess(): Promise<void> {
  const { backend, raw } = await readRawState();
  if (
    raw.consecutiveFailures === 0 &&
    raw.firstFailureAt === null &&
    raw.lastFailureAt === null &&
    raw.openUntil === null
  ) {
    return;
  }

  await writeRawState(backend, emptyState());
}

export async function recordAICircuitBreakerFailure(details: {
  reason: string;
  statusCode?: number;
  provider?: string;
}): Promise<AICircuitBreakerSnapshot> {
  const now = Date.now();
  const failureThreshold = getFailureThreshold();
  const failureWindowMs = getFailureWindowMs();
  const cooldownMs = getCooldownMs();
  const { backend, raw } = await readRawState();

  let next: StoredCircuitBreakerState;
  const wasHalfOpen = raw.openUntil !== null && raw.openUntil <= now;
  const stillWithinWindow =
    raw.firstFailureAt !== null && now - raw.firstFailureAt <= failureWindowMs && !wasHalfOpen;

  if (wasHalfOpen) {
    next = {
      consecutiveFailures: raw.consecutiveFailures > 0 ? raw.consecutiveFailures : failureThreshold,
      firstFailureAt: raw.firstFailureAt ?? now,
      lastFailureAt: now,
      lastFailureReason: details.reason,
      openUntil: now + cooldownMs,
      lastOpenedAt: now,
    };
  } else {
    const consecutiveFailures = stillWithinWindow ? raw.consecutiveFailures + 1 : 1;
    const firstFailureAt = stillWithinWindow ? raw.firstFailureAt : now;
    const shouldOpen = consecutiveFailures >= failureThreshold;

    next = {
      consecutiveFailures,
      firstFailureAt,
      lastFailureAt: now,
      lastFailureReason: details.reason,
      openUntil: shouldOpen ? now + cooldownMs : raw.openUntil,
      lastOpenedAt: shouldOpen ? now : raw.lastOpenedAt,
    };
  }

  await writeRawState(backend, next);
  const snapshot = buildSnapshot(backend, next, now);

  if (snapshot.state === "open") {
    logger.warn("AI circuit breaker opened", {
      context: "ai-circuit-breaker",
      provider: details.provider,
      statusCode: details.statusCode,
      consecutiveFailures: snapshot.consecutiveFailures,
      openUntil: snapshot.openUntil,
      reason: details.reason,
    });
  }

  return snapshot;
}

export async function fetchWithAICircuitBreaker(
  input: string,
  init: RequestInit,
  meta: { provider: string },
): Promise<Response> {
  const allowed = await assertAICircuitBreakerAllowsRequests();
  if (!allowed.ok) {
    throw new AICircuitBreakerOpenError(allowed.snapshot);
  }

  try {
    const response = await fetch(input, init);
    if (response.ok) {
      await recordAICircuitBreakerSuccess();
      return response;
    }

    if (shouldTripAICircuitBreaker(response.status)) {
      await recordAICircuitBreakerFailure({
        provider: meta.provider,
        statusCode: response.status,
        reason: `http_${response.status}`,
      });
    }

    return response;
  } catch (error) {
    const reason =
      error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : error instanceof Error
          ? error.message
          : String(error);

    await recordAICircuitBreakerFailure({
      provider: meta.provider,
      reason,
    });
    throw error;
  }
}
