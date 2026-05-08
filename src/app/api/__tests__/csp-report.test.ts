/**
 * Route handler tests for POST /api/csp-report.
 *
 * Verifies the hardening from Audit #7:
 * - Hard cap on body size (16 KiB → 413)
 * - Per-IP rate limiting (60 req / 60s → 429)
 * - Field truncation on logged report values
 * - Invalid JSON / missing report still returns 204
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const loggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => loggerError(...args),
    debug: vi.fn(),
  },
}));

const limiterCheck = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return {
    ...actual,
    createRateLimiter: () => ({ check: limiterCheck }),
  };
});

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://example.com/api/csp-report", {
    method: "POST",
    headers: {
      "content-type": "application/csp-report",
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
    body,
  });
}

describe("POST /api/csp-report — hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterCheck.mockResolvedValue(true);
  });

  it("rejects payloads larger than 16 KiB with 413 before parsing", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const oversized = "x".repeat(16 * 1024 + 1);
    const res = await POST(makeRequest(oversized));
    expect(res.status).toBe(413);
    expect(loggerError).not.toHaveBeenCalled();
    expect(limiterCheck).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-IP rate limit is exceeded", async () => {
    limiterCheck.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/csp-report/route");
    const res = await POST(
      makeRequest(JSON.stringify({ "csp-report": { "blocked-uri": "https://x" } })),
    );
    expect(res.status).toBe(429);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("returns 204 and logs truncated fields for a valid violation", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const longValue = "a".repeat(2000);
    const body = JSON.stringify({
      "csp-report": {
        "blocked-uri": longValue,
        "violated-directive": "script-src",
        "document-uri": "https://app.example.com/page",
        referrer: "",
        "original-policy": longValue,
      },
    });

    const res = await POST(makeRequest(body));
    expect(res.status).toBe(204);
    expect(loggerError).toHaveBeenCalledTimes(1);

    const [, payload] = loggerError.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.context).toBe("csp-report");
    expect(payload.alert).toBe(true);
    expect((payload.blockedUri as string).length).toBe(500);
    expect(payload.violatedDirective).toBe("script-src");
    expect(payload.documentUri).toBe("https://app.example.com/page");
    // original-policy is intentionally not forwarded to the logger
    expect(payload).not.toHaveProperty("originalPolicy");
  });

  it("returns 204 silently for invalid JSON without logging", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const res = await POST(makeRequest("{not json"));
    expect(res.status).toBe(204);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("returns 204 silently when the payload is missing csp-report", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const res = await POST(makeRequest(JSON.stringify({ other: "value" })));
    expect(res.status).toBe(204);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it("ignores non-string fields rather than logging undefined or coerced values", async () => {
    const { POST } = await import("@/app/api/csp-report/route");
    const body = JSON.stringify({
      "csp-report": {
        "blocked-uri": { malicious: "object" },
        "violated-directive": ["array"],
        "document-uri": 42,
      },
    });
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(204);
    expect(loggerError).toHaveBeenCalledTimes(1);
    const [, payload] = loggerError.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.blockedUri).toBeUndefined();
    expect(payload.violatedDirective).toBeUndefined();
    expect(payload.documentUri).toBeUndefined();
  });

  it("GET returns 204 No Content", async () => {
    const { GET } = await import("@/app/api/csp-report/route");
    const res = await GET();
    expect(res.status).toBe(204);
  });
});
