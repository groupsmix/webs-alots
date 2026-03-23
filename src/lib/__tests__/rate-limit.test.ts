import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractClientIp, createRateLimiter } from "../rate-limit";

// Mock NextRequest
function createMockRequest(headers: Record<string, string> = {}): { headers: { get: (name: string) => string | null } } {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

describe("extractClientIp", () => {
  it("extracts CF-Connecting-IP header", () => {
    const req = createMockRequest({ "cf-connecting-ip": "1.2.3.4" });
    expect(extractClientIp(req as never)).toBe("1.2.3.4");
  });

  it("falls back to X-Real-IP", () => {
    const req = createMockRequest({ "x-real-ip": "5.6.7.8" });
    expect(extractClientIp(req as never)).toBe("5.6.7.8");
  });

  it("falls back to X-Forwarded-For (first entry)", () => {
    const req = createMockRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(extractClientIp(req as never)).toBe("10.0.0.1");
  });

  it("trims whitespace from X-Forwarded-For", () => {
    const req = createMockRequest({ "x-forwarded-for": "  10.0.0.1  , 10.0.0.2" });
    expect(extractClientIp(req as never)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no headers present", () => {
    const req = createMockRequest({});
    expect(extractClientIp(req as never)).toBe("unknown");
  });

  it("prefers CF-Connecting-IP over other headers", () => {
    const req = createMockRequest({
      "cf-connecting-ip": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3",
    });
    expect(extractClientIp(req as never)).toBe("1.1.1.1");
  });

  it("prefers X-Real-IP over X-Forwarded-For", () => {
    const req = createMockRequest({
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3",
    });
    expect(extractClientIp(req as never)).toBe("2.2.2.2");
  });
});

describe("createRateLimiter (in-memory)", () => {
  beforeEach(() => {
    // Force in-memory backend
    process.env.RATE_LIMIT_BACKEND = "memory";
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_BACKEND;
  });

  it("allows requests within the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("ip-1")).toBe(true);
    }
  });

  it("blocks requests exceeding the limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check("ip-2")).toBe(true);
    expect(limiter.check("ip-2")).toBe(true);
    expect(limiter.check("ip-2")).toBe(true);
    expect(limiter.check("ip-2")).toBe(false);
  });

  it("tracks different keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("ip-a")).toBe(true);
    expect(limiter.check("ip-b")).toBe(true);
    expect(limiter.check("ip-a")).toBe(false);
    expect(limiter.check("ip-b")).toBe(false);
  });

  it("rejects new keys when maxKeys is reached", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 2 });
    expect(limiter.check("ip-1")).toBe(true);
    expect(limiter.check("ip-2")).toBe(true);
    expect(limiter.check("ip-3")).toBe(false); // maxKeys exceeded
  });

  it("allows existing keys even when maxKeys is reached", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 2 });
    limiter.check("ip-1");
    limiter.check("ip-2");
    expect(limiter.check("ip-1")).toBe(true); // existing key still works
  });
});
