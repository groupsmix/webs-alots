/**
 * Tests for safeRedirectPath — open-redirect hardening on the post-login
 * `?redirect=` param.
 *
 * Covers the audit fixes:
 *   P2-2: backslash-authority redirects (`/\evil.com`, encoded `%5Cevil`).
 *   P2-3: malformed percent-encoding must NOT throw (would 500 the Worker).
 */

import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "@/lib/middleware/routes";

describe("safeRedirectPath", () => {
  it("allows simple same-origin paths", () => {
    expect(safeRedirectPath("/")).toBe("/");
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/clinic/abc/patients?tab=2")).toBe("/clinic/abc/patients?tab=2");
  });

  it("rejects protocol-relative redirects (`//host`)", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com/path")).toBe("/");
  });

  it("P2-2: rejects backslash-authority redirects (`/\\host`)", () => {
    // Browsers/proxies treat `\` as `/` in the authority position, so these
    // resolve to `//evil.com` — a protocol-relative open redirect.
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("/\\/evil.com")).toBe("/");
    expect(safeRedirectPath("\\\\evil.com")).toBe("/");
  });

  it("P2-2: rejects percent-encoded separators after decoding", () => {
    expect(safeRedirectPath("%2F%2Fevil.com")).toBe("/"); // //evil.com
    expect(safeRedirectPath("%2f%5cevil.com")).toBe("/"); // /\evil.com
    expect(safeRedirectPath("/%5Cevil.com")).toBe("/"); // /\evil.com
  });

  it("rejects Unicode slash look-alikes (incl. ones NFKC does NOT fold)", () => {
    // NFKC folds U+FF0F FULLWIDTH SOLIDUS → "/", but does NOT fold U+2215
    // DIVISION SLASH or U+2044 FRACTION SLASH. The strict ASCII allowlist on
    // the leading char rejects all of them regardless of normalization.
    expect(safeRedirectPath("\uff0f\uff0fevil.com")).toBe("/");
    expect(safeRedirectPath("/\u2215evil.com")).toBe("/");
    expect(safeRedirectPath("/\u2044evil.com")).toBe("/");
    expect(safeRedirectPath("/\u29f8evil.com")).toBe("/");
  });

  it("allows legitimate query strings and nested segments", () => {
    expect(safeRedirectPath("/a/b?x=1&y=2")).toBe("/a/b?x=1&y=2");
    expect(safeRedirectPath("/~user/profile")).toBe("/~user/profile");
  });

  it("rejects absolute URLs and non-slash starts", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("evil.com")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("P2-3: does not throw on malformed percent-encoding, falls back to '/'", () => {
    // A lone `%` or truncated escape makes decodeURIComponent throw a URIError.
    expect(() => safeRedirectPath("%")).not.toThrow();
    expect(safeRedirectPath("%")).toBe("/");
    expect(safeRedirectPath("/%E0%A4")).toBe("/");
    expect(safeRedirectPath("/%ZZ")).toBe("/");
  });
});
