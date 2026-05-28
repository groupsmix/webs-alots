/**
 * Middleware rate-limiting tests.
 *
 * Exercises the real `applyRateLimit` from `../rate-limiting` with the
 * rate-limit backends and subdomain cache mocked so limiter decisions are
 * deterministic. Covers: the CI bypass, per-rule limiting (allow + 429),
 * the safe-method skip on the `/api/` catch-all, the global page limiter
 * for non-API paths, static-asset skipping, and the per-clinic cap
 * (including subdomain-cache keying).
 */
import { NextResponse, NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { applyRateLimit } from "../rate-limiting";
import type { CspHeaderValues } from "../security-headers";

const h = vi.hoisted(() => ({
  apptCheck: vi.fn(),
  catchAllCheck: vi.fn(),
  globalCheck: vi.fn(),
  clinicCheck: vi.fn(),
  subdomainGet: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRules: [
    { prefix: "/api/appointments", limiter: { check: h.apptCheck }, windowMs: 60_000, max: 10 },
    { prefix: "/api/", limiter: { check: h.catchAllCheck }, windowMs: 60_000, max: 30 },
  ],
  extractClientIp: () => "1.2.3.4",
  globalPageLimiter: { check: h.globalCheck },
  perClinicLimiter: { check: h.clinicCheck },
}));

vi.mock("@/lib/subdomain-cache", () => ({
  subdomainCache: { get: h.subdomainGet },
  SUBDOMAIN_CACHE_TTL_MS: 60_000,
}));

const csp: CspHeaderValues = { enforce: "", reportOnly: "" };
const withSecurityHeaders = (r: NextResponse) => r;
const ORIGINAL_GHA = process.env.GITHUB_ACTIONS;

function makeRequest(url: string, method = "GET"): NextRequest {
  const host = new URL(url).host;
  return new NextRequest(url, { method, headers: { host } });
}

beforeEach(() => {
  // Disable the CI bypass so the real limiting logic runs.
  delete process.env.GITHUB_ACTIONS;
  h.apptCheck.mockResolvedValue(true);
  h.catchAllCheck.mockResolvedValue(true);
  h.globalCheck.mockResolvedValue(true);
  h.clinicCheck.mockResolvedValue(true);
  h.subdomainGet.mockReturnValue(undefined);
});

afterEach(() => {
  process.env.GITHUB_ACTIONS = ORIGINAL_GHA;
  vi.clearAllMocks();
});

describe("applyRateLimit — CI bypass", () => {
  it("short-circuits to null when GITHUB_ACTIONS=true", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const { response } = await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(response).toBeNull();
    expect(h.apptCheck).not.toHaveBeenCalled();
  });
});

describe("applyRateLimit — per-rule limiting", () => {
  it("allows a request the matching rule permits", async () => {
    const { response } = await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(response).toBeNull();
    expect(h.apptCheck).toHaveBeenCalledWith("clinic.oltigo.com:1.2.3.4");
  });

  it("returns 429 with Retry-After + rate-limit info when the rule denies", async () => {
    h.apptCheck.mockResolvedValue(false);
    const { response, rateLimitInfo } = await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("60");
    expect(rateLimitInfo).toEqual({ limit: 10, remaining: 0, reset: expect.any(Number) });
  });

  it("skips the /api/ catch-all rule for safe methods but still applies the global limiter", async () => {
    await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/health", "GET"),
      csp,
      withSecurityHeaders,
    );
    expect(h.catchAllCheck).not.toHaveBeenCalled();
    expect(h.globalCheck).toHaveBeenCalled();
  });

  it("applies the /api/ catch-all rule for mutations", async () => {
    await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/health", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(h.catchAllCheck).toHaveBeenCalledWith("clinic.oltigo.com:1.2.3.4");
  });
});

describe("applyRateLimit — global page limiter", () => {
  it("returns 429 for a non-API page when the global limiter denies", async () => {
    h.globalCheck.mockResolvedValue(false);
    const { response } = await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/dashboard", "GET"),
      csp,
      withSecurityHeaders,
    );
    expect(response?.status).toBe(429);
    expect(h.globalCheck).toHaveBeenCalledWith("global_clinic.oltigo.com:1.2.3.4");
  });

  it("skips rate limiting entirely for static assets", async () => {
    const { response } = await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/styles/app.css", "GET"),
      csp,
      withSecurityHeaders,
    );
    expect(response).toBeNull();
    expect(h.globalCheck).not.toHaveBeenCalled();
  });
});

describe("applyRateLimit — per-clinic cap", () => {
  it("keys the clinic limiter on hostname when the subdomain cache misses", async () => {
    await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(h.clinicCheck).toHaveBeenCalledWith("clinic:clinic.oltigo.com");
  });

  it("keys the clinic limiter on the cached clinic id when the cache hits", async () => {
    h.subdomainGet.mockReturnValue({ id: "clinic-uuid-123", cachedAt: Date.now() });
    await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(h.clinicCheck).toHaveBeenCalledWith("clinic:clinic-uuid-123");
  });

  it("returns 429 with the clinic-specific code when the clinic cap is exceeded", async () => {
    h.clinicCheck.mockResolvedValue(false);
    const { response } = await applyRateLimit(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      csp,
      withSecurityHeaders,
    );
    expect(response?.status).toBe(429);
    const body = await response!.json();
    expect(body.code).toBe("CLINIC_RATE_LIMIT_EXCEEDED");
  });
});
