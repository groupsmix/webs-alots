import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

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

// Writable reference to process.env that avoids TS read-only errors on NODE_ENV
const env = process.env as Record<string, string | undefined>;

describe("CORS module", () => {
  const originalAllowedOrigins = env.ALLOWED_API_ORIGINS;
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    if (originalAllowedOrigins !== undefined) {
      env.ALLOWED_API_ORIGINS = originalAllowedOrigins;
    } else {
      delete env.ALLOWED_API_ORIGINS;
    }
    if (originalNodeEnv !== undefined) {
      env.NODE_ENV = originalNodeEnv;
    } else {
      delete env.NODE_ENV;
    }
    vi.resetModules();
  });

  describe("deny-by-default when env var is unset", () => {
    beforeEach(() => {
      delete env.ALLOWED_API_ORIGINS;
      vi.resetModules();
    });

    it("omits Access-Control-Allow-Origin when no origins configured", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://evil.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    // A49-3: When origin is denied, ALL CORS headers are omitted
    it("omits all CORS headers when origin is denied", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://evil.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(Object.keys(headers)).toHaveLength(0);
    });
  });

  describe("wildcard origin (dev mode)", () => {
    beforeEach(() => {
      env.ALLOWED_API_ORIGINS = "*";
      delete env.NODE_ENV;
      vi.resetModules();
    });

    it("returns * for any origin when wildcard is configured in dev", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://anything.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    });

    it("does not add Vary header when wildcard is used", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://test.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Vary"]).toBeUndefined();
    });
  });

  // A49-2: Wildcard blocked in production
  describe("wildcard origin blocked in production", () => {
    beforeEach(() => {
      env.ALLOWED_API_ORIGINS = "*";
      env.NODE_ENV = "production";
      vi.resetModules();
    });

    it("denies all origins when wildcard is set in production", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://anything.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(Object.keys(headers)).toHaveLength(0);
    });
  });

  describe("explicit allowlist", () => {
    beforeEach(() => {
      env.ALLOWED_API_ORIGINS = "https://app.oltigo.com,https://admin.oltigo.com";
      vi.resetModules();
    });

    it("allows matching origin", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://app.oltigo.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.oltigo.com");
    });

    it("adds Vary header for specific origins", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://app.oltigo.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Vary"]).toBe("Origin");
    });

    it("blocks non-matching origin", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://evil.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("case-insensitive origin matching", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://APP.OLTIGO.COM");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBe("https://app.oltigo.com");
    });

    it("blocks when no origin header present in request", async () => {
      const mod = await import("../cors");
      const req = createMockRequest();
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });
  });

  describe("handlePreflight", () => {
    beforeEach(() => {
      delete env.ALLOWED_API_ORIGINS;
      vi.resetModules();
    });

    it("returns 204 status for OPTIONS preflight", async () => {
      const mod = await import("../cors");
      const req = createMockRequest();
      const response = mod.handlePreflight(req as never);
      expect(response.status).toBe(204);
    });

    it("returns null body for preflight", async () => {
      const mod = await import("../cors");
      const req = createMockRequest();
      const response = mod.handlePreflight(req as never);
      expect(response.body).toBeNull();
    });
  });
});
