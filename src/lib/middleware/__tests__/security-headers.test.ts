/**
 * Regression tests for the empty-CSP guard in
 * `withSecurityHeaders` and `applyAllSecurityHeaders`.
 *
 * Bug: when `CspHeaderValues.enforce` is an empty string (e.g. a future
 * report-only-only mode), the helpers were unconditionally setting a
 * blank `Content-Security-Policy` header. Code that checks for the
 * header's presence (e.g. `headers.has("Content-Security-Policy")`)
 * would see the blank header instead of either no header or the actual
 * policy. The middleware-side request-header forwarding has the same
 * guard for the same reason — see `src/middleware.ts:115`.
 */
import { NextResponse } from "next/server";
import { describe, it, expect } from "vitest";
import {
  withSecurityHeaders,
  applyAllSecurityHeaders,
  buildCspHeaderValues,
  type CspHeaderValues,
} from "../security-headers";

describe("withSecurityHeaders — CSP guard", () => {
  it("sets Content-Security-Policy when enforce is non-empty", () => {
    const response = NextResponse.json({ ok: true });
    const csp = buildCspHeaderValues("test-nonce");

    withSecurityHeaders(response, csp);

    expect(response.headers.get("Content-Security-Policy")).toBe(csp.enforce);
    expect(response.headers.has("Content-Security-Policy-Report-Only")).toBe(
      false,
    );
  });

  it("does not forward an empty Content-Security-Policy header", () => {
    const response = NextResponse.json({ ok: true });
    // Pre-populate with a stale value to prove the helper deletes it.
    response.headers.set("Content-Security-Policy", "stale");

    const csp: CspHeaderValues = { enforce: "", reportOnly: "" };
    withSecurityHeaders(response, csp);

    expect(response.headers.has("Content-Security-Policy")).toBe(false);
    // Sibling defense-in-depth headers must still be applied.
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("applyAllSecurityHeaders — CSP guard", () => {
  it("sets Content-Security-Policy when enforce is non-empty", () => {
    const response = NextResponse.json({ ok: true });
    const csp = buildCspHeaderValues("test-nonce");

    applyAllSecurityHeaders(response, csp, "test-nonce");

    expect(response.headers.get("Content-Security-Policy")).toBe(csp.enforce);
  });

  it("does not forward an empty Content-Security-Policy header", () => {
    const response = NextResponse.json({ ok: true });
    response.headers.set("Content-Security-Policy", "stale");

    const csp: CspHeaderValues = { enforce: "", reportOnly: "" };
    applyAllSecurityHeaders(response, csp, "test-nonce");

    expect(response.headers.has("Content-Security-Policy")).toBe(false);
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});
