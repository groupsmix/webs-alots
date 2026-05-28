import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger } from "../logger";
import { extractClientIp, createRateLimiter } from "../rate-limit";

// Mock NextRequest
function createMockRequest(headers: Record<string, string> = {}): {
  headers: { get: (name: string) => string | null };
} {
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

  it("falls back to X-Real-IP when CF-Connecting-IP is absent", () => {
    const req = createMockRequest({ "x-real-ip": "5.6.7.8" });
    expect(extractClientIp(req as never)).toBe("5.6.7.8");
  });

  it("falls back to X-Forwarded-For (first IP) when CF-Connecting-IP is absent", () => {
    const req = createMockRequest({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" });
    expect(extractClientIp(req as never)).toBe("10.0.0.1");
  });

  it("trims whitespace in X-Forwarded-For entries", () => {
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

  it("prefers X-Forwarded-For over X-Real-IP when CF-Connecting-IP is absent", () => {
    const req = createMockRequest({
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3",
    });
    expect(extractClientIp(req as never)).toBe("3.3.3.3");
  });

  it("rejects forged XFF with control characters", () => {
    const req = createMockRequest({ "x-forwarded-for": "evil\x00ip" });
    expect(extractClientIp(req as never)).toBe("unknown");
  });

  it("rejects overly long IP addresses (>45 chars)", () => {
    const req = createMockRequest({ "x-forwarded-for": "a".repeat(46) });
    expect(extractClientIp(req as never)).toBe("unknown");
  });

  it("accepts valid IPv6 addresses", () => {
    const req = createMockRequest({
      "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    });
    expect(extractClientIp(req as never)).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });

  it("rejects XFF with protocol prefix", () => {
    const req = createMockRequest({ "x-forwarded-for": "https://1.2.3.4" });
    expect(extractClientIp(req as never)).toBe("unknown");
  });

  it("rejects empty XFF value", () => {
    const req = createMockRequest({ "x-forwarded-for": "" });
    expect(extractClientIp(req as never)).toBe("unknown");
  });
});

describe("createRateLimiter (in-memory)", () => {
  let loggerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Force in-memory backend
    process.env.RATE_LIMIT_BACKEND = "memory";
    // Suppress expected warnings about in-memory rate limiter in tests
    loggerSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_BACKEND;
    loggerSpy.mockRestore();
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

  it("evicts oldest key when maxKeys is reached (LRU)", () => {
    // A78-01: Changed from reject-when-full to LRU eviction.
    // New keys now evict the oldest entry instead of being rejected.
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 2 });
    expect(limiter.check("ip-1")).toBe(true);
    expect(limiter.check("ip-2")).toBe(true);
    expect(limiter.check("ip-3")).toBe(true); // evicts ip-1, admits ip-3
  });

  it("allows existing keys even when maxKeys is reached", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 10, maxKeys: 2 });
    limiter.check("ip-1");
    limiter.check("ip-2");
    expect(limiter.check("ip-1")).toBe(true); // existing key still works
  });

  it("resets counter after window expires", () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter({ windowMs: 1_000, max: 2 });
      expect(limiter.check("ip-x")).toBe(true);
      expect(limiter.check("ip-x")).toBe(true);
      expect(limiter.check("ip-x")).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(limiter.check("ip-x")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("max: 1 allows exactly one request", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("single")).toBe(true);
    expect(limiter.check("single")).toBe(false);
  });
});
