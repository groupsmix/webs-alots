/**
 * k6 smoke / load test — Oltigo Health staging.
 *
 * This file is run MANUALLY only. Automated post-deploy checks use
 * scripts/smoke-post-deploy.mjs (no k6 dependency).
 *
 * Usage:
 *   # Install k6: https://k6.io/docs/get-started/installation/
 *
 *   # Smoke mode (default — 2 VUs, 30 s, safe for any environment):
 *   k6 run --env BASE_URL=https://staging.oltigo.com k6/smoke.js
 *
 *   # Load mode (100-VU ramp — staging/preview only, explicit opt-in required):
 *   k6 run --env BASE_URL=https://staging.oltigo.com --env SMOKE_MODE=load k6/smoke.js
 *
 *   # Production (requires explicit opt-in to prevent accidents):
 *   k6 run --env BASE_URL=https://oltigo.com --env ALLOW_PROD=true k6/smoke.js
 *
 *   # NOTE: load mode is refused against production even with ALLOW_PROD=true.
 *
 * Thresholds enforced (mode-aware):
 *   Smoke mode (default, ~150 samples — all-or-nothing, zero failures):
 *     - http_availability: rate>=1   (every probe must return an expected status)
 *     - http_req_failed:   rate<=0   (no request failures)
 *     - p95 latencies (cold-start tolerant): ping<500ms, status/health<1000ms, landing<1500ms
 *   Load mode (100-VU ramp — statistical SLOs meaningful at volume):
 *     - http_availability: rate>0.999
 *     - http_req_failed:   rate<0.001
 *     - p95 latencies: ping<300ms, status/health<500ms, landing<800ms
 */

/* eslint-disable import/no-anonymous-default-export */
import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

// ── Custom metrics ──────────────────────────────────────────────────────────

/**
 * HTTP-layer availability: tracks whether the endpoint returned an expected
 * HTTP status (2xx or the documented 503 for degraded). This is intentionally
 * separated from JSON-body assertion checks so a malformed response body does
 * not falsely trip the availability SLO — the HTTP layer may be healthy even
 * when the JSON shape is wrong, and those are different failure modes.
 */
const httpAvailability = new Rate("http_availability");

// ── Allowed host allowlist ───────────────────────────────────────────────────

/**
 * Only these hostnames (and their subdomains) are recognised as known
 * Oltigo hosts. Any other host is rejected to prevent accidentally running
 * a load test against an attacker-controlled URL or a typo'd domain.
 *
 * Fix #1: replaces the old `endsWith(".oltigo.com")` check which could be
 * bypassed by a crafted hostname such as "staging.oltigo.com.evil.com".
 */
const ALLOWED_HOSTS = ["oltigo.com", "staging.oltigo.com", "preview.oltigo.com", "localhost"];

function classifyHost(hostname) {
  // Loopback is always local.
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "local";
  }
  // Exact match against a known host.
  if (ALLOWED_HOSTS.includes(hostname)) {
    return hostname.startsWith("staging") || hostname.startsWith("preview") ? "non-prod" : "prod";
  }
  // Subdomain of a known host (e.g. "pr-42.preview.oltigo.com").
  for (const allowed of ALLOWED_HOSTS) {
    if (allowed === "localhost") continue;
    if (hostname.endsWith(`.${allowed}`)) {
      // A demo/staging/preview-prefixed subdomain of oltigo.com is non-prod.
      if (
        allowed === "oltigo.com" &&
        (hostname.startsWith("staging") ||
          hostname.startsWith("preview") ||
          hostname.startsWith("demo"))
      ) {
        return "non-prod";
      }
      return allowed === "oltigo.com" ? "prod" : "non-prod";
    }
  }
  return "unknown";
}

// ── Setup: validate environment ──────────────────────────────────────────────

export function setup() {
  const baseUrl = __ENV.BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "BASE_URL is required. Example: k6 run --env BASE_URL=https://staging.oltigo.com k6/smoke.js",
    );
  }

  // Parse the URL to inspect the scheme and hostname directly — substring
  // matching on the raw string is unsafe and bypassable.
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`BASE_URL is not a valid URL: ${baseUrl}`);
  }

  const hostname = parsed.hostname;
  const hostClass = classifyHost(hostname);
  const isLocal = hostClass === "local";

  // Fix #2 — HTTPS enforcement: reject plaintext URLs so auth cookies and
  // tokens are never sent over the wire unencrypted, even on "internal"
  // networks. Localhost/loopback is exempt for local dev.
  if (!isLocal && parsed.protocol !== "https:") {
    throw new Error(
      `BASE_URL must use HTTPS (got '${parsed.protocol}'). ` +
        `Plaintext URLs are not permitted — even on staging, credentials travel over the wire.`,
    );
  }

  // Fix #1 — allowlist-based host classification replaces the fragile substring
  // match. An unrecognised host (e.g. "staging.oltigo.com.evil.com") is refused
  // outright rather than silently hammering an unknown server.
  if (hostClass === "unknown") {
    throw new Error(
      `BASE_URL hostname '${hostname}' is not a recognised Oltigo host. ` +
        `Allowed hosts: ${ALLOWED_HOSTS.join(", ")} (and their subdomains). ` +
        `If this is intentional, add it to the ALLOWED_HOSTS list in k6/smoke.js.`,
    );
  }

  const isProd = hostClass === "prod";
  if (isProd && __ENV.ALLOW_PROD !== "true") {
    throw new Error(
      `BASE_URL resolves to a production host (${hostname}). Set --env ALLOW_PROD=true to confirm.`,
    );
  }

  // Fix #7 — Load mode is staging/preview ONLY. Previously this was documented
  // in the header but NOT enforced: with ALLOW_PROD=true a 100-VU ramp could be
  // pointed straight at production. Refuse it outright — even with ALLOW_PROD —
  // so a smoke run can never accidentally turn into a prod load test.
  if (isProd && isLoadMode) {
    throw new Error(
      `Load mode (100-VU ramp) is not permitted against production (${hostname}). ` +
        `Run load tests against a staging/preview host instead. ALLOW_PROD does not override this.`,
    );
  }

  return { baseUrl };
}

// ── Scenario options ─────────────────────────────────────────────────────────

const smokeScenario = {
  executor: "constant-vus",
  vus: 2,
  duration: "30s",
};

const loadScenario = {
  executor: "ramping-vus",
  stages: [
    { duration: "30s", target: 20 }, // ramp up
    { duration: "3m", target: 100 }, // sustain at 100 VUs
    { duration: "30s", target: 0 }, // ramp down
  ],
};

const isLoadMode = __ENV.SMOKE_MODE === "load";

/**
 * Fix #8 — Thresholds are now mode-aware.
 *
 * The previous single threshold set used statistical SLOs (rate>0.999,
 * rate<0.001) for BOTH modes. That is meaningless — and misleading — in the
 * default smoke mode: 2 VUs for 30 s yields only ~150 samples, so a SINGLE
 * failed probe already drops availability to ~0.994 (below 0.999) and the run
 * fails anyway. The "99.9%" framing implied a tolerance that does not exist at
 * that sample size.
 *
 *   - Smoke mode  → all-or-nothing. Every probe must succeed (zero failures),
 *     stated honestly as rate>=1 / rate<=0. Latency budgets are relaxed to
 *     tolerate cold starts on a freshly woken / just-deployed environment.
 *   - Load mode   → the real statistical SLOs, which only become meaningful at
 *     the volume the 100-VU ramp produces.
 */
const smokeThresholds = {
  // Every HTTP-layer probe must return an expected status — no failures.
  http_availability: ["rate>=1"],
  // Zero request failures tolerated at this tiny sample size.
  http_req_failed: ["rate<=0"],
  // Cold-start-tolerant latency budgets (a just-woken Worker/edge is slower).
  "http_req_duration{endpoint:ping}": ["p(95)<500"],
  "http_req_duration{endpoint:status}": ["p(95)<1000"],
  "http_req_duration{endpoint:health}": ["p(95)<1000"],
  "http_req_duration{endpoint:landing}": ["p(95)<1500"],
};

const loadThresholds = {
  // HTTP-layer availability SLO: > 99.9% of probes must get an expected status.
  http_availability: ["rate>0.999"],
  // Overall error rate < 0.1%.
  http_req_failed: ["rate<0.001"],
  // Per-endpoint p95 latency budgets (tagged thresholds).
  "http_req_duration{endpoint:ping}": ["p(95)<300"],
  "http_req_duration{endpoint:status}": ["p(95)<500"],
  "http_req_duration{endpoint:health}": ["p(95)<500"],
  "http_req_duration{endpoint:landing}": ["p(95)<800"],
};

export const options = {
  scenarios: {
    main: isLoadMode ? loadScenario : smokeScenario,
  },
  thresholds: isLoadMode ? loadThresholds : smokeThresholds,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a JSON response body with a diagnostic log on failure.
 * Returns the parsed object on success, or null on failure so callers can
 * distinguish a parse error from a deliberate null value.
 *
 * Fix #5 / Fix #6: used for assertion-only checks kept separate from the
 * HTTP-layer availability metric, and emits a diagnostic warning (including
 * the Content-Type) so malformed bodies aren't silently masked as check=false.
 */
function parseJsonBody(r, label) {
  const ct = r.headers["Content-Type"] || "?";
  if (!ct.includes("application/json")) {
    console.warn(
      `[${label}] unexpected Content-Type '${ct}' (status=${r.status}) — expected application/json`,
    );
  }
  try {
    return JSON.parse(r.body);
  } catch (e) {
    console.warn(
      `[${label}] JSON.parse failed (status=${r.status} content-type=${ct}): ${e.message}`,
    );
    return null;
  }
}

// ── Main scenario ─────────────────────────────────────────────────────────────

// Fix #4 — Per-request timeout budget. If the server hangs beyond this window
// the test fails fast rather than waiting up to the 60 s k6 default.
const REQUEST_PARAMS = { timeout: "5s" };

export default function (data) {
  const BASE_URL = data.baseUrl;

  // ── /api/ping — liveness probe ────────────────────────────────────────────
  // Must be 200. Any other status = hard failure.
  const ping = http.get(`${BASE_URL}/api/ping`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "ping" },
  });
  // HTTP-layer SLO: 200 expected.
  const pingHttpOk = check(ping, {
    "ping 200": (r) => r.status === 200,
  });
  httpAvailability.add(pingHttpOk);

  // ── /api/status — platform status ─────────────────────────────────────────
  // Accepts 200 (operational/degraded) and 503 (down). The route returns 503
  // ONLY when the overall snapshot status is "down" (i.e. a probed service is
  // down); a "degraded" snapshot still returns 200. 503 is therefore an
  // expected, intentionally-reported state — NOT an infra failure — so it must
  // not trip http_req_failed.
  const status = http.get(`${BASE_URL}/api/status`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "status" },
    responseCallback: http.expectedStatuses(200, 503),
  });
  // HTTP-layer SLO: 200 or 503 both count as the endpoint being reachable.
  const statusHttpOk = check(status, {
    "status 200 or 503": (r) => r.status === 200 || r.status === 503,
  });
  httpAvailability.add(statusHttpOk);
  // JSON-body assertion (separate from SLO — a bad body ≠ an unavailable service).
  // The status route returns the snapshot directly (NOT wrapped by apiSuccess),
  // so `status` is a top-level string: "operational" | "degraded" | "down".
  const statusBody = parseJsonBody(status, "status");
  check(status, {
    "status has status field": () => statusBody !== null && typeof statusBody.status === "string",
  });

  // ── /api/health — readiness probe ─────────────────────────────────────────
  // 200 = healthy/degraded, 503 = unhealthy (a dependency is down). The route
  // returns 503 ONLY when the overall status is "unhealthy"; "degraded" still
  // returns 200.
  const health = http.get(`${BASE_URL}/api/health`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "health" },
    responseCallback: http.expectedStatuses(200, 503),
  });
  // HTTP-layer SLO: 200 or 503.
  const healthHttpOk = check(health, {
    "health 200 or 503": (r) => r.status === 200 || r.status === 503,
  });
  httpAvailability.add(healthHttpOk);
  // JSON-body assertion (separate from SLO).
  //
  // Fix #9 — corrected contract. /api/health is wrapped by apiSuccess(), so the
  // body shape is { ok: true, data: HealthResponse } and the real status lives
  // at `data.status` — NOT the top level. Its values are
  // "healthy" | "degraded" | "unhealthy" (the route NEVER emits "ok").
  // The previous check read `healthBody.status` and compared against "ok"/
  // "degraded", so it failed 100% of the time on every environment. This now
  // matches the contract used by scripts/smoke-post-deploy.mjs (which reads
  // body.data.status), with a top-level fallback for forward-compat. A healthy
  // or degraded service passes; "unhealthy" (a dependency down) is a failure.
  const healthBody = parseJsonBody(health, "health");
  check(health, {
    "health reports healthy or degraded": () => {
      if (healthBody === null) return false;
      const wrapped = healthBody.data;
      const s =
        wrapped && typeof wrapped.status === "string"
          ? wrapped.status
          : typeof healthBody.status === "string"
            ? healthBody.status
            : null;
      return s === "healthy" || s === "degraded";
    },
  });

  // ── / — landing page ──────────────────────────────────────────────────────
  // Accepts any 2xx or 3xx — the CDN may redirect to a locale-prefixed URL
  // (e.g. /fr/) which is correct behaviour, not a failure.
  const landing = http.get(`${BASE_URL}/`, {
    ...REQUEST_PARAMS,
    tags: { endpoint: "landing" },
    responseCallback: http.expectedStatuses({ min: 200, max: 399 }),
  });
  const landingHttpOk = check(landing, {
    "landing 2xx or 3xx": (r) => r.status >= 200 && r.status <= 399,
  });
  httpAvailability.add(landingHttpOk);

  // Fix #3 — Jitter on think time to avoid synchronised request waves.
  // Range: 0.5 s – 2.5 s (uniform random).
  sleep(Math.random() * 2 + 0.5);
}
