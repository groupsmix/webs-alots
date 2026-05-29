/**
 * CORS allow-list tests.
 *
 * Exercises the real `applyCors` from `../cors`: API-path gating, exempt
 * server-to-server prefixes, the apex/subdomain/localhost allow-list,
 * preflight (OPTIONS) handling, and header application onto a response.
 */
import { NextResponse, NextRequest } from "next/server";
import { describe, it, expect, afterEach } from "vitest";
import { applyCors } from "../cors";

// Writable reference to process.env that avoids TS read-only errors on NODE_ENV.
const env = process.env as Record<string, string | undefined>;
const ORIGINAL_NODE_ENV = env.NODE_ENV;

function makeRequest(
  url: string,
  method = "GET",
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, { method, headers });
}

afterEach(() => {
  env.NODE_ENV = ORIGINAL_NODE_ENV;
  delete process.env.ROOT_DOMAIN;
});

describe("applyCors — gating", () => {
  it("ignores non-API routes", () => {
    expect(
      applyCors(
        makeRequest("https://x.oltigo.com/dashboard", "GET", { origin: "https://x.oltigo.com" }),
        null,
      ),
    ).toBeNull();
  });

  it.each(["/api/webhooks", "/api/cron/x", "/api/payments/webhook"])(
    "skips CORS for exempt prefix %s",
    (path) => {
      const res = NextResponse.json({ ok: true });
      applyCors(
        makeRequest(`https://x.oltigo.com${path}`, "GET", { origin: "https://x.oltigo.com" }),
        res,
      );
      expect(res.headers.has("Access-Control-Allow-Origin")).toBe(false);
    },
  );

  it("returns null when no Origin header is present", () => {
    expect(applyCors(makeRequest("https://x.oltigo.com/api/foo", "GET"), null)).toBeNull();
  });
});

describe("applyCors — allow-list", () => {
  it("reflects an allowed apex origin onto the response", () => {
    process.env.ROOT_DOMAIN = "oltigo.com";
    const res = NextResponse.json({ ok: true });
    applyCors(
      makeRequest("https://oltigo.com/api/foo", "GET", { origin: "https://oltigo.com" }),
      res,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://oltigo.com");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("reflects an allowed tenant subdomain origin", () => {
    process.env.ROOT_DOMAIN = "oltigo.com";
    const res = NextResponse.json({ ok: true });
    applyCors(
      makeRequest("https://clinic.oltigo.com/api/foo", "GET", {
        origin: "https://clinic.oltigo.com",
      }),
      res,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://clinic.oltigo.com");
  });

  it("does not set CORS headers for a foreign origin", () => {
    process.env.ROOT_DOMAIN = "oltigo.com";
    const res = NextResponse.json({ ok: true });
    applyCors(
      makeRequest("https://clinic.oltigo.com/api/foo", "GET", { origin: "https://evil.example" }),
      res,
    );
    expect(res.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("rejects localhost in production but allows it otherwise", () => {
    process.env.ROOT_DOMAIN = "oltigo.com";
    const prodRes = NextResponse.json({ ok: true });
    env.NODE_ENV = "production";
    applyCors(
      makeRequest("https://clinic.oltigo.com/api/foo", "GET", { origin: "http://localhost:3000" }),
      prodRes,
    );
    expect(prodRes.headers.has("Access-Control-Allow-Origin")).toBe(false);

    const devRes = NextResponse.json({ ok: true });
    env.NODE_ENV = "development";
    applyCors(
      makeRequest("https://clinic.oltigo.com/api/foo", "GET", { origin: "http://localhost:3000" }),
      devRes,
    );
    expect(devRes.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });

  it("ignores a malformed origin without throwing", () => {
    process.env.ROOT_DOMAIN = "oltigo.com";
    const res = NextResponse.json({ ok: true });
    applyCors(
      makeRequest("https://clinic.oltigo.com/api/foo", "GET", { origin: "not-a-url" }),
      res,
    );
    expect(res.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});

describe("applyCors — preflight", () => {
  it("returns a 204 preflight response for an allowed OPTIONS request", () => {
    process.env.ROOT_DOMAIN = "oltigo.com";
    const result = applyCors(
      makeRequest("https://clinic.oltigo.com/api/foo", "OPTIONS", {
        origin: "https://clinic.oltigo.com",
      }),
      null,
    );
    expect(result).not.toBeNull();
    expect(result?.status).toBe(204);
    expect(result?.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
  });
});
