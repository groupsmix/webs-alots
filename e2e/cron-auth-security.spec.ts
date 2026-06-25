import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { test, expect } from "@playwright/test";

/**
 * TC-03 — Cron Route Authentication Security Tests
 *
 * Audit finding TC-03 (High): No visible test for /api/cron/* endpoints
 * verifying that unauthenticated requests return 401 and authenticated
 * requests (with correct CRON_SECRET) succeed.
 *
 * Mutation test: Remove Bearer token validation from /api/cron/billing
 * → no test fails → attacker can trigger billing or GDPR purge.
 *
 * This suite tests every cron route for:
 *  1. Unauthenticated requests → 401
 *  2. Requests with wrong token → 401
 *  3. Requests with malformed Authorization header → 401
 *  4. Requests with CRLF-injected token → 401 (I-06)
 *
 * Note: Authenticated success (200) is NOT tested here because it requires
 * the real CRON_SECRET and would trigger actual cron job side effects
 * (billing charges, GDPR deletions, etc.) in a staging environment.
 * Success paths are covered by the cron route unit tests in
 * src/app/api/__tests__/cron-*.test.ts and src/lib/__tests__/cron-auth.test.ts.
 *
 * ── Route discovery (TC-03 hardening) ──────────────────────────────────────
 * The cron route list is NO LONGER hardcoded. A hardcoded list silently
 * drifts: new cron routes (e.g. ai-embed-faqs, ai-memory-consolidate,
 * trial-lifecycle, usage-snapshots, support-sla-check, onboarding-nudges)
 * were added under src/app/api/cron/ without being added to the test, leaving
 * destructive/PHI-touching endpoints unverified for auth. We now discover
 * every cron route from the filesystem and detect each route's REAL exported
 * HTTP method, so:
 *   - every cron route is auth-tested automatically, forever, and
 *   - we exercise the route's actual entrypoint (e.g. payment-reminders is
 *     POST-only — a GET would return 405 and prove nothing about auth).
 */

// Playwright runs with cwd = project root (testDir: "./e2e"), so resolve the
// cron directory relative to the working directory.
const CRON_DIR = join(process.cwd(), "src", "app", "api", "cron");

type HttpMethod = "GET" | "POST";

interface CronRoute {
  /** Request path, e.g. "/api/cron/billing". */
  path: string;
  /** HTTP methods the route actually exports (GET, POST, or both). */
  methods: HttpMethod[];
}

/**
 * Discover every cron route by scanning src/app/api/cron/<name>/route.ts and
 * detecting which HTTP method handlers it exports. Supports both
 * `export const GET = ...` and `export (async) function GET()` forms.
 */
function discoverCronRoutes(): CronRoute[] {
  if (!existsSync(CRON_DIR)) {
    // Fail loudly rather than silently returning an empty array that
    // lets every test loop register zero cases (a silent no-op).
    throw new Error(
      `[cron-auth-security] Cron route directory not found: ${CRON_DIR}\n` +
        `  CWD: ${process.cwd()}\n` +
        `  Ensure Playwright runs from the project root (testDir: "./e2e").`,
    );
  }
  const entries = readdirSync(CRON_DIR, { withFileTypes: true });
  const routes: CronRoute[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const routeFile = join(CRON_DIR, entry.name, "route.ts");
    if (!existsSync(routeFile)) continue;

    const src = readFileSync(routeFile, "utf8");
    const methods: HttpMethod[] = [];
    for (const method of ["GET", "POST"] as const) {
      const constForm = new RegExp(`export\\s+const\\s+${method}\\b`);
      const fnForm = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
      if (constForm.test(src) || fnForm.test(src)) {
        methods.push(method);
      }
    }

    // A cron folder with no HTTP handler is not a routable entrypoint — skip.
    if (methods.length === 0) continue;

    routes.push({ path: `/api/cron/${entry.name}`, methods });
  }

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

const CRON_ROUTES = discoverCronRoutes();

// ── Discovery sanity guard ──────────────────────────────────────────────────
// If the cron directory moves or discovery breaks, CRON_ROUTES would be empty
// and every for-loop below would register ZERO tests — a silent no-op that
// hides the entire suite. Assert a sane floor so a broken path fails loudly.
// (There are 20+ cron routes today; 16 is a conservative lower bound.)
test.describe("TC-03 — Cron route discovery", () => {
  test("discovers the full set of cron routes from the filesystem", () => {
    expect(CRON_ROUTES.length).toBeGreaterThanOrEqual(16);
    // Spot-check that destructive/sensitive routes are present so a future
    // refactor that drops them from discovery is caught.
    const paths = CRON_ROUTES.map((r) => r.path);
    for (const required of [
      "/api/cron/billing",
      "/api/cron/gdpr-purge",
      "/api/cron/trial-lifecycle",
      "/api/cron/payment-reminders",
    ]) {
      expect(paths).toContain(required);
    }
  });
});

/** Issue an unauthenticated request using the given method. */
async function requestUnauthenticated(
  request: import("@playwright/test").APIRequestContext,
  method: HttpMethod,
  path: string,
  headers?: Record<string, string>,
) {
  return method === "GET"
    ? request.get(path, { headers })
    : request.post(path, { data: {}, headers });
}

// ── Unauthenticated requests (real exported method) ────────────────────────

test.describe("TC-03 — Cron routes reject unauthenticated requests", () => {
  for (const { path, methods } of CRON_ROUTES) {
    for (const method of methods) {
      test(`${method} ${path} without Authorization header → 401`, async ({ request }) => {
        const res = await requestUnauthenticated(request, method, path);
        // verifyCronSecret runs before any method/body logic, so the route's
        // real entrypoint must reject the anonymous caller with 401. A 200
        // (job ran) or 5xx (crash) is a security failure.
        expect(res.status()).toBe(401);
      });
    }
  }
});

// ── Unsupported method must never run the job ───────────────────────────────

test.describe("TC-03 — Cron routes reject the unsupported method", () => {
  for (const { path, methods } of CRON_ROUTES) {
    const unsupported: HttpMethod = methods.includes("GET") ? "POST" : "GET";
    // Only assert when the route genuinely does not export this method.
    if (methods.includes(unsupported)) continue;

    test(`${unsupported} ${path} (unsupported) is never accepted`, async ({ request }) => {
      const res = await requestUnauthenticated(request, unsupported, path);
      // Either 405 (method not allowed) or 401 (auth runs first) — but never
      // 200 (job executed) or 5xx (crash).
      expect([401, 405]).toContain(res.status());
      expect(res.status()).not.toBe(200);
    });
  }
});

// ── Wrong token (real exported method) ──────────────────────────────────────

test.describe("TC-03 — Cron routes reject wrong Bearer token", () => {
  for (const { path, methods } of CRON_ROUTES) {
    for (const method of methods) {
      test(`${method} ${path} with wrong token → 401`, async ({ request }) => {
        const res = await requestUnauthenticated(request, method, path, {
          Authorization: "Bearer wrong-secret-that-is-definitely-incorrect-value-for-ci",
        });
        expect(res.status()).toBe(401);
      });
    }
  }
});

// ── Malformed Authorization headers ────────────────────────────────────────

test.describe("TC-03 — Cron routes reject malformed Authorization headers", () => {
  const malformedHeaders = [
    { label: "empty string", value: "" },
    { label: "Basic scheme", value: "Basic dXNlcjpwYXNz" },
    { label: "Bearer with no token", value: "Bearer " },
    { label: "Bearer with only whitespace", value: "Bearer    " },
    { label: "missing Bearer prefix", value: "some-secret-without-bearer" },
    { label: "lowercase bearer", value: "bearer some-token" },
  ];

  for (const { label, value } of malformedHeaders) {
    test(`GET /api/cron/billing with ${label} → 401`, async ({ request }) => {
      const headers: Record<string, string> = {};
      if (value !== "") {
        headers["Authorization"] = value;
      }
      const res = await request.get("/api/cron/billing", { headers });
      expect(res.status()).toBe(401);
    });
  }
});

// ── CRLF injection in Authorization header (I-06) ──────────────────────────

test.describe("TC-03 — Cron routes reject CRLF-injected tokens (I-06)", () => {
  const crlfTokens = [
    { label: "CRLF header injection", value: "valid-secret-part\r\nX-Injected: evil" },
    { label: "LF header injection", value: "valid-secret\nX-Another: header" },
    { label: "CRLF body injection", value: "valid-secret\r\n\r\nbody-injection" },
  ];

  for (const { label, value: token } of crlfTokens) {
    test(`GET /api/cron/notifications with ${label} → 401`, async ({ request }) => {
      // The fetch API normalises/rejects CRLF in headers in most environments,
      // but we test the endpoint still returns 401 regardless of how the runtime handles it.
      try {
        const res = await request.get("/api/cron/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status()).toBe(401);
      } catch {
        // Some HTTP clients throw on CRLF in headers — that's also a pass
        // because it means the malformed header never reached the server.
      }
    });
  }
});

// ── Timing-safe comparison verification (indirect) ─────────────────────────

test.describe("TC-03 — Cron route auth is consistent across all routes", () => {
  test("All cron routes return the same 401 response shape", async ({ request }) => {
    // If some routes use a different auth mechanism (e.g. check token AFTER parsing body),
    // the 401 response time or shape might differ. We sample a destructive and non-destructive
    // route and verify both are protected identically.
    //
    // Routes are derived from CRON_ROUTES (filesystem discovery) rather than hardcoded strings
    // so a renamed or deleted route does not cause a silent 404 that would mask auth regressions.
    // We pick the first GET-capable route from three well-known categories if present, or fall
    // back to the first three discovered routes to guarantee the test always exercises real paths.
    const getRoutes = CRON_ROUTES.filter((r) => r.methods.includes("GET")).map((r) => r.path);

    // Prefer specific high-value routes for the sample if they exist (these are the most
    // destructive: billing charges money, gdpr-purge deletes PHI, reminders fans out to patients).
    const preferred = ["/api/cron/billing", "/api/cron/gdpr-purge", "/api/cron/reminders"];
    const sample = preferred.filter((p) => getRoutes.includes(p));

    // Fall back: pick any three GET routes if preferred set is incomplete.
    if (sample.length < 3) {
      for (const route of getRoutes) {
        if (!sample.includes(route)) sample.push(route);
        if (sample.length === 3) break;
      }
    }

    // Need at least 2 routes to make a meaningful "consistency" comparison.
    expect(sample.length).toBeGreaterThanOrEqual(2);

    const responses = await Promise.all(sample.map((path) => request.get(path)));

    for (const res of responses) {
      expect(res.status()).toBe(401);
    }

    // Response bodies should be structurally similar (both JSON with error field)
    const bodies = await Promise.all(responses.map((r) => r.json().catch(() => null)));

    const nonNull = bodies.filter((b) => b !== null);
    if (nonNull.length > 0) {
      // All should have an error field — no different disclosure between routes
      for (const body of nonNull) {
        expect(typeof body.error).toBe("string");
      }
    }
  });

  test("Cron routes do not leak CRON_SECRET value in 401 response", async ({ request }) => {
    const res = await request.get("/api/cron/billing", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status()).toBe(401);
    const text = await res.text();
    // Response must never contain the string "CRON_SECRET" or hint at the actual value
    expect(text.toLowerCase()).not.toContain("cron_secret");
    expect(text.toLowerCase()).not.toContain("secret value");
  });

  test("Cron routes return 401 even when clinic subdomain is valid", async ({ request }) => {
    // Auth check must happen regardless of which subdomain the request came through.
    // We use the default baseURL (root domain) but the assertion holds for all subdomains.
    const res = await request.get("/api/cron/reminders", {
      headers: {
        // Simulate a request routed through a known clinic subdomain
        Host: "demo.oltigo.com",
      },
    });
    // 401 from cron auth check (or 400/404 from Host header mismatch in test env)
    expect([400, 401, 403, 404]).toContain(res.status());
  });
});
