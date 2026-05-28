import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
  const originalEnv = process.env.ALLOWED_API_ORIGINS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ALLOWED_API_ORIGINS = originalEnv;
    } else {
      delete process.env.ALLOWED_API_ORIGINS;
    }
    vi.resetModules();
  });

  describe("deny-by-default when env var is unset", () => {
    beforeEach(() => {
      delete process.env.ALLOWED_API_ORIGINS;
      vi.resetModules();
    });

    it("omits Access-Control-Allow-Origin when no origins configured", async () => {
      const mod = await import("../cors");
      const req = createMockRequest("https://evil.com");
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("still includes standard CORS method and header entries", async () => {
      const mod = await import("../cors");
      const req = createMockRequest();
      const headers = mod.getCorsHeaders(req as never);
      expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
      expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type, Authorization");
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });
  });

  describe("wildcard origin (dev mode)", () => {
    beforeEach(() => {
      process.env.ALLOWED_API_ORIGINS = "*";
      vi.resetModules();
    });

    it("returns * for any origin when wildcard is configured", async () => {
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

  describe("explicit allowlist", () => {
    beforeEach(() => {
      process.env.ALLOWED_API_ORIGINS = "https://app.oltigo.com,https://admin.oltigo.com";
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
      delete process.env.ALLOWED_API_ORIGINS;
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
