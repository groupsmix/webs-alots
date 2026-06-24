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
 *   # Load mode (100-VU ramp — staging only, explicit opt-in required):
 *   k6 run --env BASE_URL=https://staging.oltigo.com --env SMOKE_MODE=load k6/smoke.js
 *
 *   # Production (requires explicit opt-in to prevent accidents):
 *   k6 run --env BASE_URL=https://oltigo.com --env ALLOW_PROD=true k6/smoke.js
 *
 * Thresholds enforced:
 *   - http_availability (custom Rate): > 99.9% HTTP-layer health (2xx/503)
 *   - http_req_failed:                 < 0.1%  (k6 built-in)
 *   - per-endpoint p95 durations:      ping < 300ms, status/health < 500ms, landing < 800ms
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

  // #2 — HTTPS enforcement: reject plaintext URLs so auth cookies and tokens
  // are never sent over the wire unencrypted, even on "internal" networks.
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (!isLocal && parsed.protocol !== "https:") {
    throw new Error(
      `BASE_URL must use HTTPS (got '${parsed.protocol}'). ` +
        `Plaintext URLs are not permitted — even on staging, credentials travel over the wire.`,
    );
  }

  // #1 — Production guard with allowlist.
  //
  // A hostname is "production oltigo.com" if it IS oltigo.com, or if it ends
  // with a dot-separated segment that is exactly "oltigo.com" — i.e. the
  // ".oltigo.com" suffix is preceded by another label, not by an unrelated TLD
  // (e.g. "evil.com.oltigo.com" is still caught; "staging.oltigo.com" is
  // excluded by the startsWith checks below).
  //
  // The remaining risk is a crafted hostname like "staging.oltigo.com.evil.com"
  // — that does NOT end with ".oltigo.com", so the isProd flag stays false and
  // the guard does not fire. However, the request is still going to an unknown
  // host. We address this with an explicit allowlist: if the host is not a
  // recognised oltigo.com variant AND not localhost, we refuse to run.
  const isOltigoHost = hostname === "oltigo.com" || hostname.endsWith(".oltigo.com");

  if (!isLocal && !isOltigoHost) {
    // The host is neither localhost nor a known oltigo.com subdomain — refuse
    // outright rather than silently hammering an unknown server.
    throw new Error(
      `BASE_URL hostname '${hostname}' is not a recognised oltigo.com host or localhost. ` +
        `If this is intentional, edit the allowlist in k6/smoke.js.`,
    );
  }

  const isProd =
    isOltigoHost &&
    !hostname.startsWith("staging") &&
    !hostname.startsWith("preview") &&
    !hostname.startsWith("demo");

  if (isProd && __ENV.ALLOW_PROD !== "true") {
    throw new Error(
      `BASE_URL resolves to a production host (${hostname}). Set --env ALLOW_PROD=true to confirm.`,
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

export const options = {
  scenarios: {
    main: isLoadMode ? loadScenario : smokeScenario,
  },
  thresholds: {
    // HTTP-layer availability SLO: > 99.9% of probes must get an expected status.
    http_availability: ["rate>0.999"],

    // Overall error rate < 0.1%.
    http_req_failed: ["rate<0.001"],

    // Per-endpoint p95 latency budgets (tagged thresholds).
    "http_req_duration{endpoint:ping}": ["p(95)<300"],
    "http_req_duration{endpoint:status}": ["p(95)<500"],
    "http_req_duration{endpoint:health}": ["p(95)<500"],
    "http_req_duration{endpoint:landing}": ["p(95)<800"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a JSON response body with a diagnostic log on failure.
 * Returns the parsed object on success, or null on failure so callers can
 * distinguish a parse error from a deliberate null value.
 */
function parseJsonBody(r, label) {
  try {
    return JSON.parse(r.body);
  } catch (e) {
    // #6 — Log the root cause so failures aren't silently masked as check=false.
    console.warn(
      `[${label}] JSON.parse failed (status=${r.status} content-type=${r.headers["Content-Type"] || "?"}): ${e.message}`,
    );
    return null;
  }
}

// ── Main scenario ─────────────────────────────────────────────────────────────

// #4 — Per-request timeout budget. If the server hangs beyond this window the
// test fails fast rather than waiting up to the 60 s k6 default.
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
  // Accepts 200 (all ok) and 503 (degraded but intentionally reported).
  // 503 is an expected response when a subsystem is disabled (e.g. AI kill
  // switch), NOT an infrastructure failure — don't trip http_req_failed.
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
  const statusBody = parseJsonBody(status, "status");
  check(status, {
    "status has status field": () => statusBody !== null && typeof statusBody.status === "string",
  });

  // ── /api/health — readiness probe ─────────────────────────────────────────
  // Same contract as /api/status: 200 = healthy, 503 = degraded but responsive.
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
  const healthBody = parseJsonBody(health, "health");
  check(health, {
    "health has status value": () =>
      healthBody !== null && (healthBody.status === "ok" || healthBody.status === "degraded"),
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

  // #3 — Jitter on think time to avoid synchronised request waves.
  // Range: 0.5 s – 2.5 s (uniform random).
  sleep(Math.random() * 2 + 0.5);
}
