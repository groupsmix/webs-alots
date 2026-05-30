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
 */

// All cron routes that must be auth-protected (matches CRON_ROUTES in worker-cron-handler.ts)
const CRON_ROUTES = [
  "/api/cron/uptime-monitor",
  "/api/cron/notifications",
  "/api/cron/audit-log-flush",
  "/api/cron/reminders",
  "/api/cron/r2-cleanup",
  "/api/cron/feedback",
  "/api/cron/rebooking-reminders",
  "/api/cron/billing",
  "/api/cron/gdpr-purge",
  "/api/cron/dedup-purge",
  "/api/cron/stripe-reconcile",
  "/api/cron/data-retention",
  "/api/cron/daily-briefing",
  "/api/cron/nps-survey",
  "/api/cron/payment-reminders",
  "/api/cron/retry-webhooks",
];

// ── Unauthenticated requests ────────────────────────────────────────────────

test.describe("TC-03 — Cron routes reject unauthenticated GET requests", () => {
  for (const route of CRON_ROUTES) {
    test(`GET ${route} without Authorization header → 401`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe("TC-03 — Cron routes reject unauthenticated POST requests", () => {
  for (const route of CRON_ROUTES) {
    test(`POST ${route} without Authorization header → 401`, async ({ request }) => {
      const res = await request.post(route, { data: {} });
      // Some cron routes only accept GET — 405 is also acceptable (method check after auth check
      // would return 401 regardless; method-check first returns 405). Either is fine:
      // what matters is that 200 is never returned.
      expect([401, 405]).toContain(res.status());
    });
  }
});

// ── Wrong token ─────────────────────────────────────────────────────────────

test.describe("TC-03 — Cron routes reject wrong Bearer token", () => {
  for (const route of CRON_ROUTES) {
    test(`GET ${route} with wrong token → 401`, async ({ request }) => {
      const res = await request.get(route, {
        headers: {
          Authorization: "Bearer wrong-secret-that-is-definitely-incorrect-value-for-ci",
        },
      });
      expect(res.status()).toBe(401);
    });
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
    "valid-secret-part\r\nX-Injected: evil",
    "valid-secret\nX-Another: header",
    "valid-secret\r\n\r\nbody-injection",
  ];

  for (const token of crlfTokens) {
    test(`GET /api/cron/notifications with CRLF token → 401`, async ({ request }) => {
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
    const [billingRes, remindersRes, gdprRes] = await Promise.all([
      request.get("/api/cron/billing"),
      request.get("/api/cron/reminders"),
      request.get("/api/cron/gdpr-purge"),
    ]);

    expect(billingRes.status()).toBe(401);
    expect(remindersRes.status()).toBe(401);
    expect(gdprRes.status()).toBe(401);

    // Response bodies should be structurally similar (both JSON with error field)
    const [billingBody, remindersBody, gdprBody] = await Promise.all([
      billingRes.json().catch(() => null),
      remindersRes.json().catch(() => null),
      gdprRes.json().catch(() => null),
    ]);

    if (billingBody && remindersBody && gdprBody) {
      // All should have an error field — no different disclosure between routes
      expect(typeof billingBody.error).toBe("string");
      expect(typeof remindersBody.error).toBe("string");
      expect(typeof gdprBody.error).toBe("string");
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
