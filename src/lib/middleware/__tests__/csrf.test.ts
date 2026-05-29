/**
 * CSRF Origin-validation tests.
 *
 * Exercises the real `validateCsrf` from `../csrf` against constructed
 * NextRequests. Covers: method/path gating, exempt routes (exact +
 * trailing-slash normalization + cron prefix), missing-Origin rejection,
 * the cross-tenant allow-list lock, and the NEXT_PUBLIC_SITE_URL allowance.
 */
import { NextResponse, NextRequest } from "next/server";
import { describe, it, expect, vi, afterEach } from "vitest";
import { validateCsrf } from "../csrf";
import type { CspHeaderValues } from "../security-headers";

const csp: CspHeaderValues = { enforce: "", reportOnly: "" };
// Passthrough that lets us assert the helper is invoked on the failure paths.
const withSecurityHeaders = vi.fn((r: NextResponse) => r);

function makeRequest(
  url: string,
  method = "POST",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, { method, headers });
}

afterEach(() => {
  withSecurityHeaders.mockClear();
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("validateCsrf — gating", () => {
  it("passes through non-API paths", () => {
    const result = validateCsrf(
      makeRequest("https://clinic.oltigo.com/dashboard", "POST"),
      "clinic.oltigo.com",
      csp,
      withSecurityHeaders,
    );
    expect(result).toBeNull();
    expect(withSecurityHeaders).not.toHaveBeenCalled();
  });

  it("passes through safe (non-mutation) methods even with no Origin", () => {
    const result = validateCsrf(
      makeRequest("https://clinic.oltigo.com/api/patients", "GET"),
      "clinic.oltigo.com",
      csp,
      withSecurityHeaders,
    );
    expect(result).toBeNull();
  });
});

describe("validateCsrf — exempt routes", () => {
  it.each([
    "https://clinic.oltigo.com/api/webhooks",
    "https://clinic.oltigo.com/api/payments/webhook",
    "https://clinic.oltigo.com/api/payments/cmi/callback",
    "https://clinic.oltigo.com/api/csp-report",
  ])("exempts %s without an Origin header", (url) => {
    expect(
      validateCsrf(makeRequest(url, "POST"), "clinic.oltigo.com", csp, withSecurityHeaders),
    ).toBeNull();
  });

  it("normalizes a trailing slash when matching exact exempt paths", () => {
    expect(
      validateCsrf(
        makeRequest("https://clinic.oltigo.com/api/webhooks/", "POST"),
        "clinic.oltigo.com",
        csp,
        withSecurityHeaders,
      ),
    ).toBeNull();
  });

  it("exempts any cron route via the prefix", () => {
    expect(
      validateCsrf(
        makeRequest("https://clinic.oltigo.com/api/cron/send-reminders", "POST"),
        "clinic.oltigo.com",
        csp,
        withSecurityHeaders,
      ),
    ).toBeNull();
  });
});

describe("validateCsrf — Origin enforcement", () => {
  it("rejects a mutation API request with a missing Origin header (403)", () => {
    const result = validateCsrf(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST"),
      "clinic.oltigo.com",
      csp,
      withSecurityHeaders,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    expect(withSecurityHeaders).toHaveBeenCalledOnce();
  });

  it("allows a same-host Origin", () => {
    const result = validateCsrf(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST", {
        origin: "https://clinic.oltigo.com",
      }),
      "clinic.oltigo.com",
      csp,
      withSecurityHeaders,
    );
    expect(result).toBeNull();
  });

  it("rejects a cross-tenant Origin even on the same root domain (403)", async () => {
    const result = validateCsrf(
      makeRequest("https://clinic-a.oltigo.com/api/appointments", "POST", {
        origin: "https://clinic-b.oltigo.com",
      }),
      "clinic-a.oltigo.com",
      csp,
      withSecurityHeaders,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toContain("origin not allowed");
  });

  it("allows the configured NEXT_PUBLIC_SITE_URL origin (trailing slash tolerant)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.oltigo.com/";
    const result = validateCsrf(
      makeRequest("https://clinic.oltigo.com/api/appointments", "POST", {
        origin: "https://app.oltigo.com",
      }),
      "clinic.oltigo.com",
      csp,
      withSecurityHeaders,
    );
    expect(result).toBeNull();
  });
});
