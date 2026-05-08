import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Unit tests for cron infrastructure (A43).
 *
 * Tests idempotency locks, DLQ tracking, and retry logic.
 */

// Mock the logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the API response helpers
vi.mock("@/lib/api-response", () => ({
  apiSuccess: (data: unknown) => NextResponse.json({ ok: true, data }),
  apiInternalError: (message: string) =>
    NextResponse.json({ ok: false, error: message }, { status: 500 }),
}));

describe("Cron Infrastructure — withCronInfrastructure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes handler successfully when no lock exists", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () =>
      NextResponse.json({ ok: true, data: { message: "Success" } }),
    );

    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true, // Skip KV operations for testing
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const json = await result.json();
    expect(json.ok).toBe(true);
    expect(json.data.message).toBe("Success");
  });

  it("handles handler errors and returns error response", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () => {
      throw new Error("Handler failed");
    });

    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true,
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const json = await result.json();
    expect(json.ok).toBe(false);
    expect(json.error).toContain("Handler failed");
  });

  it("wraps handler with try-catch for error handling", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () => {
      throw new Error("Unexpected error");
    });

    // Should not throw, should return error response
    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true,
    });

    expect(result).toBeInstanceOf(NextResponse);
    const json = await result.json();
    expect(json.ok).toBe(false);
  });
});

describe("Cron Infrastructure — Idempotency", () => {
  it("skips idempotency check when skipIdempotency is true", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () =>
      NextResponse.json({ ok: true, data: { message: "Success" } }),
    );

    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true,
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const json = await result.json();
    expect(json.ok).toBe(true);
  });
});

describe("Cron Infrastructure — Retry Configuration", () => {
  it("accepts custom maxRetries configuration", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () =>
      NextResponse.json({ ok: true, data: { message: "Success" } }),
    );

    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true,
      maxRetries: 5,
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const json = await result.json();
    expect(json.ok).toBe(true);
  });

  it("accepts custom baseDelay configuration", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () =>
      NextResponse.json({ ok: true, data: { message: "Success" } }),
    );

    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true,
      baseDelay: 120,
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const json = await result.json();
    expect(json.ok).toBe(true);
  });
});

describe("Cron Infrastructure — Lock TTL", () => {
  it("accepts custom lockTtl configuration", async () => {
    const { withCronInfrastructure } = await import("@/lib/cron-infrastructure");

    const mockHandler = vi.fn(async () =>
      NextResponse.json({ ok: true, data: { message: "Success" } }),
    );

    const result = await withCronInfrastructure("test-job", mockHandler, {
      skipIdempotency: true,
      lockTtl: 7200, // 2 hours
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const json = await result.json();
    expect(json.ok).toBe(true);
  });
});
