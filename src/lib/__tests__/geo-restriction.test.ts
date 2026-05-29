import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockRequest(pathname: string, headers: Record<string, string> = {}) {
  return {
    nextUrl: { pathname },
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as import("next/server").NextRequest;
}

describe("geo-restriction", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults to blocking non-MA requests when no env vars are set", async () => {
    delete process.env.GEO_RESTRICT_ADMIN;
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", { "cf-ipcountry": "US" });
    const result = checkGeoRestriction(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("allows MA requests by default when no env vars are set", async () => {
    delete process.env.GEO_RESTRICT_ADMIN;
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", { "cf-ipcountry": "MA" });
    expect(checkGeoRestriction(req)).toBeNull();
  });

  it("allows all requests when ADMIN_GEO_RESTRICTION_ENABLED=false", async () => {
    process.env.ADMIN_GEO_RESTRICTION_ENABLED = "false";
    delete process.env.GEO_RESTRICT_ADMIN;
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", { "cf-ipcountry": "US" });
    expect(checkGeoRestriction(req)).toBeNull();
  });

  it("allows requests from allowed countries", async () => {
    process.env.GEO_RESTRICT_ADMIN = "MA,FR";
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", { "cf-ipcountry": "MA" });
    expect(checkGeoRestriction(req)).toBeNull();
  });

  it("blocks requests from non-allowed countries", async () => {
    process.env.GEO_RESTRICT_ADMIN = "MA,FR";
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", { "cf-ipcountry": "US" });
    const result = checkGeoRestriction(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("blocks Tor exit nodes (T1)", async () => {
    process.env.GEO_RESTRICT_ADMIN = "MA,FR";
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/dashboard/patients", { "cf-ipcountry": "T1" });
    const result = checkGeoRestriction(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("skips non-admin routes", async () => {
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    process.env.GEO_RESTRICT_ADMIN = "MA";
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/booking/new", { "cf-ipcountry": "US" });
    expect(checkGeoRestriction(req)).toBeNull();
  });

  it("skips when CF-IPCountry header is absent (non-Cloudflare)", async () => {
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    process.env.GEO_RESTRICT_ADMIN = "MA";
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", {});
    expect(checkGeoRestriction(req)).toBeNull();
  });

  it("is case-insensitive for country codes", async () => {
    delete process.env.ADMIN_GEO_RESTRICTION_ENABLED;
    process.env.GEO_RESTRICT_ADMIN = "ma,fr";
    const { checkGeoRestriction } = await import("@/lib/middleware/geo-restriction");
    const req = createMockRequest("/admin/settings", { "cf-ipcountry": "MA" });
    expect(checkGeoRestriction(req)).toBeNull();
  });
});
