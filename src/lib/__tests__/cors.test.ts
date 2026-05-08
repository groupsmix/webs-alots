import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We need to re-import the module fresh for each test since it memoizes
// the parsed origins. We'll test the public API by manipulating env vars.

function createMockRequest(origin?: string): { headers: { get: (name: string) => string | null } } {
  return {
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "origin") return origin ?? null;
        return null;
      },
    },
  };
}

describe("CORS module", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ALLOWED_API_ORIGINS;
    // Reset the memoized _parsedOrigins by re-importing the module
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Since the module memoizes, we test the core logic patterns
  describe("CORS allowlist logic", () => {
    it("denies all origins when env var is unset", async () => {
      delete process.env.ALLOWED_API_ORIGINS;
      // Re-import to reset memoized state
      const mod = await import("../cors");
      const req = createMockRequest("https://evil.com");
      const headers = mod.getCorsHeaders(req as never);
      // When no origins configured, Access-Control-Allow-Origin should be absent
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("includes standard CORS method and header entries", async () => {
      const mod = await import("../cors");
      const req = createMockRequest();
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
      expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });

    it("handlePreflight returns 204 status", async () => {
      const mod = await import("../cors");
      const req = createMockRequest();
      const response = mod.handlePreflight(req as never);
      expect(response.status).toBe(204);
    });
  });
});
